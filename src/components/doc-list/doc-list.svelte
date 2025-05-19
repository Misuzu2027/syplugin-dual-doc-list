<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { DocumentTreeItemInfo } from "@/models/document-model";
    import {
        clearCssHighlights,
        escapeHTML,
        highlightElementTextByCss,
        scrollByRange,
    } from "@/utils/html-util";
    import {
        TProtyleAction,
        openMobileFileById,
        openTab,
        Constants,
        ITab,
        showMessage,
    } from "siyuan";
    import { EnvConfig } from "@/config/EnvConfig";
    import {
        queryDocumentByPath,
        queryDocumentByDb,
        isQueryDocByPathApi,
        selectItemByArrowKeys,
    } from "@/service/search/search-util";
    import { getNotebookIcon } from "@/utils/icon-util";
    import {
        DUAL_DOC_LIST_SORT_ATTR_KEY,
        SETTING_DOCUMENT_LIST_SORT_METHOD_ELEMENT,
    } from "@/models/setting-constant";
    import { isArrayEmpty, isArrayNotEmpty } from "@/utils/array-util";
    import {
        isStrBlank,
        isStrNotBlank,
        splitKeywordStringToArray,
    } from "@/utils/string-util";
    import {
        changeSort,
        createDoc,
        getBlockAttrs,
        getBlockByID,
        getDocInfo,
        listDocsByPath,
        moveDocs,
        setBlockAttrs,
    } from "@/utils/api";
    import {
        clearSyFileTreeItemFocusClass,
        convertNumberToSordMode,
        getActiveTab,
        getDesktopCurDocProtyle,
        getParentPath,
    } from "@/utils/siyuan-util";
    import { isTouchDevice } from "@/libs/siyuan/functions";
    import {
        hasClosestBySelector,
        hasClosestByTag,
        hasTopClosestByTag,
    } from "@/libs/siyuan/hasClosest";
    import { delayedTwiceRefresh } from "@/utils/timing-util";
    import { SettingService } from "@/service/setting/SettingService";
    import { PathHistory } from "@/models/PathHistory";
    import { getDisplayName, pathPosix } from "@/libs/siyuan/pathName";
    import { MenuItem } from "@/libs/siyuan/siyuan/menus/Menu";

    let rootElement: HTMLElement;
    let lastSelectDocItemIndex: number = -1;
    let inputChangeTimeoutId: any;
    let isSearching: number = 0;
    let searchInputKey: string = "";
    let lastKeywords: string[] = [];
    let documentItems: DocumentTreeItemInfo[] = [];
    let lastOpenBlockId: string;
    let previewProtyleMatchFocusIndex = 0;
    let backPathButtonEnable: boolean = false;

    let pathHistory: PathHistory = new PathHistory();

    let lockPath: boolean = false;
    let lockSortOrder: boolean = false;
    let localShowSubDocOfSubDoc: boolean = false;
    let localFullTextSearch: boolean = false;
    let showCurPath = "/";

    let curPathNotebookId: string;
    let curPathDocId: string;
    let curPathDocPath: string;
    let curPathSortMethod: DocumentSortMode;
    let curNotebookSortMethod: DocumentSortMode;
    let waitRefreshByDatabase: boolean = false;
    let waitRefreshSelectDocId: string = null;

    onMount(async () => {
        initData();
        initEvent();
        initSiyuanEventBus();

        siwtchDefaultPath();
    });

    onDestroy(() => {
        destorySiyuanEventBus();
    });

    function initData() {
        let settingConfig = SettingService.ins.SettingConfig;
        localShowSubDocOfSubDoc = settingConfig.showSubDocOfSubDoc;
        localFullTextSearch = settingConfig.fullTextSearch;
    }
    function initEvent() {
        rootElement.addEventListener("mousedown", () => {
            window.siyuan.menus.menu.remove();
        });

        rootElement.addEventListener("click", (event: any) => {
            const target = event.target;

            if (target.tagName.toLowerCase() === "span") {
                if (target.hasAttribute("data-path-type")) {
                    let pathType = target.getAttribute("data-path-type");
                    let dataId = target.getAttribute("data-id");

                    let newNotebookId = null;
                    let newDocId = null;
                    let newDocPath = null;

                    if (pathType === "box") {
                        newNotebookId = dataId;
                        newDocId = null;
                        newDocPath = "/";
                    } else if (pathType === "doc") {
                        newNotebookId = curPathNotebookId;
                        newDocId = dataId;
                        newDocPath =
                            curPathDocPath.split(dataId)[0] + dataId + ".sy";
                    }
                    if (isStrNotBlank(newNotebookId)) {
                        console.log(
                            "click path switch path ",
                            newNotebookId,
                            " ",
                            newDocId,
                            " ",
                            newDocPath,
                        );
                        switchPath(newNotebookId, newDocId, newDocPath);
                    }
                }
                if (target.hasAttribute("data-siwtch-notebook")) {
                    const rect = target.getBoundingClientRect();
                    showSwitchNotebookMenus({ x: rect.right, y: rect.bottom });
                    console.log("data-siwtch-notebook");
                    event.stopPropagation();
                }
            }
        });
    }

    async function showSwitchNotebookMenus(position: { x: number; y: number }) {
        window.siyuan.menus.menu.remove();
        EnvConfig.ins.refreshNotebookMap();
        let notebookMap = EnvConfig.ins.notebookMap;
        for (const [box, notebook] of notebookMap) {
            if (notebook.closed) {
                continue;
            }
            let icon = "";
            if (box == curPathNotebookId) {
                icon = "iconSelect";
            }
            window.siyuan.menus.menu.append(
                new MenuItem({
                    icon: icon,
                    label: getBoxIconAndNameHtmlByNotebook(notebook),
                    click: () => {
                        switchPath(box, null, null);
                    },
                }).element,
            );
        }

        window.siyuan.menus.menu.popup(position);

        // console.log(`文档右击位置 x : ${event.clientX}, y : ${event.clientY}`);
    }

    function initSiyuanEventBus() {
        // console.log("initSiyuanEventBus");
        EnvConfig.ins.plugin.eventBus.on("ws-main", wsMainHandleri);
    }

    function destorySiyuanEventBus() {
        // console.log("destorySiyuanEventBus");
        EnvConfig.ins.plugin.eventBus.off("ws-main", wsMainHandleri);
    }

    function wsMainHandleri(e: any) {
        if (!e || !e.detail) {
            return;
        }
        let detail = e.detail;

        switch (detail.cmd) {
            case "createdailynote":
            case "heading2doc":
            case "li2doc":
            case "create":
                let boxIdByCreate = detail.data.box.id as string;
                let pathByCreate = detail.data.path as string;
                if (isStrBlank(boxIdByCreate) || isStrBlank(pathByCreate)) {
                    break;
                }
                if (
                    (isStrBlank(curPathNotebookId) &&
                        isStrBlank(curPathDocId)) ||
                    (isStrNotBlank(curPathNotebookId) &&
                        curPathNotebookId == boxIdByCreate) ||
                    (isStrNotBlank(curPathDocId) &&
                        pathByCreate.includes(curPathDocId))
                ) {
                    waitRefreshByDatabase = true;
                }

                break;
            case "removeDoc":
                let ids = detail.data.ids as string[];
                if (isArrayEmpty(ids) || isArrayEmpty(documentItems)) {
                    break;
                }
                for (const item of documentItems) {
                    if (ids.includes(item.fileBlock.id)) {
                        waitRefreshByDatabase = true;
                        break;
                    }
                }
                break;
            case "moveDoc":
                if (
                    isStrNotBlank(curPathNotebookId) &&
                    (curPathNotebookId == detail.data.fromNotebook ||
                        curPathNotebookId == detail.data.toNotebook)
                ) {
                    waitRefreshByDatabase = true;
                }
                if (
                    isStrNotBlank(curPathDocId) &&
                    (detail.data.fromPath.includes(curPathDocId) ||
                        detail.data.toPath.includes(curPathDocId))
                ) {
                    waitRefreshByDatabase = true;
                }
                break;
            case "rename":
                let id = detail.data.id as string;
                if (isStrBlank(id) || isArrayEmpty(documentItems)) {
                    break;
                }
                for (const item of documentItems) {
                    if (id == item.fileBlock.id) {
                        waitRefreshByDatabase = true;
                        break;
                    }
                }
                break;
            case "databaseIndexCommit":
                if (waitRefreshByDatabase) {
                    refreshDocList();
                }
                break;
        }
        if (waitRefreshByDatabase) {
            if (localIsQueryDocByPathApi()) {
                refreshDocList();
            }
        }
    }

    export async function switchPath(
        notebookId: string,
        docId: string,
        docPath: string,
        updateHistory: boolean = true,
    ) {
        if (lockPath) {
            return;
        }
        clearItemFocus();
        clearItemSelect();
        EnvConfig.ins.refreshNotebookMap();
        curPathNotebookId = notebookId;
        curPathDocId = docId;
        curPathDocPath = docPath;

        if (updateHistory) {
            pathHistory.switchPath({ notebookId, docId, docPath });
        }
        backPathButtonEnable = pathHistory.getHistoryLength() > 1;

        // 没有锁定排序 就更新
        if (!lockSortOrder) {
            let sortMethodTemp = await getSortMethodByNotebookOrDoc(
                notebookId,
                docId,
            );
            if (sortMethodTemp) {
                curPathSortMethod = sortMethodTemp;
            }
        }

        await updateDocList(
            notebookId,
            docId,
            docPath,
            searchInputKey,
            curPathSortMethod,
        );
    }

    async function getSortMethodByNotebookOrDoc(
        notebookId: string,
        docId: string,
    ): Promise<DocumentSortMode> {
        let settingConfig = SettingService.ins.SettingConfig;
        // 获取数据库默认排序方式
        let pathSortMethodTemp = settingConfig.defaultDbQuerySortOrder;
        // 获取并更新当前笔记本排序方式
        if (isStrNotBlank(notebookId)) {
            let notebookSort =
                EnvConfig.ins.notebookMap.get(notebookId).sortMode;
            if (
                notebookSort == 15 &&
                window.siyuan.config.fileTree.sort != undefined
            ) {
                notebookSort = window.siyuan.config.fileTree.sort;
            }
            pathSortMethodTemp = convertNumberToSordMode(notebookSort);
            curNotebookSortMethod = pathSortMethodTemp;
        } else {
            curNotebookSortMethod = null;
        }

        if (isStrNotBlank(docId) && settingConfig.docDirectorySortSave) {
            let docAttrs = await getBlockAttrs(docId);
            if (docAttrs) {
                let docAttrSortMeth = docAttrs[DUAL_DOC_LIST_SORT_ATTR_KEY];
                if (isStrNotBlank(docAttrSortMeth)) {
                    return docAttrSortMeth as DocumentSortMode;
                }
            }
        }

        // 返回 数据库默认排序方式 或 笔记本排序方式
        return pathSortMethodTemp;
    }

    function documentSortMethodChange(event) {
        curPathSortMethod = event.target.value;
        if (isStrNotBlank(curPathDocId)) {
            let settingConfig = SettingService.ins.SettingConfig;
            let docSortAutoSave = settingConfig.docDirectorySortSave;
            if (docSortAutoSave) {
                setBlockAttrs(curPathDocId, {
                    [DUAL_DOC_LIST_SORT_ATTR_KEY]: curPathSortMethod,
                });
            }
        }

        refreshDocListByDocSort(curPathSortMethod);
    }

    function showAllDoc() {
        curPathNotebookId = null;
        curPathDocId = null;
        curPathDocPath = null;
        if (!lockSortOrder) {
            curPathSortMethod =
                SettingService.ins.SettingConfig.defaultDbQuerySortOrder;
        }
        switchPath(null, null, null);
        // updateDocList(
        //     curPathNotebookId,
        //     curPathDocId,
        //     curPathDocPath,
        //     searchInputKey,
        //     curPathSortMethod,
        // );
    }
    async function siwtchDefaultPath() {
        let result = await getDefaultPath();
        switchPath(result.notebookId, result.docId, result.docPath);
        // updateDocList(
        //     curPathNotebookId,
        //     curPathDocId,
        //     curPathDocPath,
        //     searchInputKey,
        //     curPathSortMethod,
        // );
    }

    async function getDefaultPath(): Promise<{
        notebookId: string;
        docId: string;
        docPath: string;
    }> {
        let defaultPathId = SettingService.ins.SettingConfig.defaultPathId;
        let notebookId = null;
        let docId = null;
        let docPath = null;
        if (isStrNotBlank(defaultPathId)) {
            let notebook = EnvConfig.ins.notebookMap.get(defaultPathId);
            if (notebook) {
                notebookId = defaultPathId;
            } else {
                let docBlock = await getBlockByID(defaultPathId);
                if (docBlock && docBlock.type == "d") {
                    notebookId = docBlock.box;
                    docId = defaultPathId;
                    docPath = docBlock.path;
                }
            }
        }
        if (isStrNotBlank(defaultPathId) && isStrBlank(notebookId)) {
            showMessage("二级文档列表：默认路径ID不存在，请重新设置。", 5000);
        }
        return { notebookId, docId, docPath };
    }

    function backPath() {
        let pathObj = pathHistory.back();
        if (!pathObj) {
            return;
        }
        switchPath(pathObj.notebookId, pathObj.docId, pathObj.docPath, false);
    }

    function forwardPath() {
        let pathObj = pathHistory.forward();
        if (!pathObj) {
            return;
        }
        switchPath(pathObj.notebookId, pathObj.docId, pathObj.docPath, false);
    }

    async function createSiblingDocClick(
        event: MouseEvent,
        item: DocumentTreeItemInfo,
    ) {
        if (!event) return;
        event.stopPropagation();
        event.preventDefault();

        if (!item) {
            return;
        }

        let notebook = item.fileBlock.box;
        let path = item.fileBlock.path;
        if (isStrBlank(notebook) || isStrBlank(path)) {
            return;
        }
        let parentPath = getParentPath(path);
        let title = window.siyuan.languages.untitled;

        const id = Lute.NewNodeID();
        const newPath = pathPosix().join(
            getDisplayName(parentPath, false, true),
            id + ".sy",
        );

        let docId = (await createDoc(notebook, newPath, title, "", null)).id;
        if (isStrBlank(docId)) {
            return;
        }

        let actions: TProtyleAction[] = [
            Constants.CB_GET_CONTEXT,
            Constants.CB_GET_OPENNEW,
        ];

        await openBlockTab(docId, null, actions);

        if (localIsQueryDocByPathApi()) {
            await refreshDocList();
            docListSelectDocById(docId);
        } else {
            waitRefreshByDatabase = true;
            waitRefreshSelectDocId = docId;
        }
    }

    let clickTimeoutId: NodeJS.Timeout | undefined;
    let clickCount: number = 0;

    async function docItemClick(event: MouseEvent) {
        if (!event) return;

        event.stopPropagation();
        event.preventDefault();

        const target = event.currentTarget as HTMLElement;
        const blockId = target.getAttribute("data-node-id");

        updateLastSelectedItemIndex(blockId);

        if (isToggleFocusEvent(event)) {
            toggleItemFocus(target);
            return;
        }
        clearItemFocus();
        clearItemSelect();
        target.classList.add("b3-list-item--focus");

        handleClickLogic(event, blockId);
    }

    async function docIconClick(event: MouseEvent, item: DocumentTreeItemInfo) {
        if (!event) return;
        event.stopPropagation();
        event.preventDefault();
        if (!item || !item.fileBlock || isStrBlank(item.fileBlock.id)) {
            return;
        }

        performDoubleClickAction(item.fileBlock.id);
    }

    function updateLastSelectedItemIndex(blockId: string | null) {
        if (blockId) {
            documentItems.forEach((item) => {
                if (item.fileBlock.id === blockId) {
                    lastSelectDocItemIndex = item.index;
                    return;
                }
            });
        }
    }

    function isToggleFocusEvent(event: MouseEvent): boolean {
        return event.ctrlKey && !event.altKey && !event.shiftKey;
    }

    function toggleItemFocus(target: HTMLElement) {
        target.classList.toggle("b3-list-item--focus");
    }

    function handleClickLogic(event: MouseEvent, blockId: string) {
        clickCount++;
        let doubleClickTimeout =
            SettingService.ins.SettingConfig.doubleClickTimeout;

        if (clickCount === 1) {
            const tabPosition = determineTabPosition(event);
            openBlockTab(blockId, tabPosition);

            clickTimeoutId = setTimeout(() => {
                clickCount = 0; // 重置计数
            }, doubleClickTimeout);
        } else {
            clickCount = 0;
            clearTimeout(clickTimeoutId);
            performDoubleClickAction(blockId);
        }
    }

    function determineTabPosition(
        event: MouseEvent,
    ): "right" | "bottom" | null {
        if (!event.ctrlKey && event.altKey && !event.shiftKey) {
            return "right";
        }
        if (!event.ctrlKey && !event.altKey && event.shiftKey) {
            return "bottom";
        }
        return null;
    }

    async function performDoubleClickAction(blockId: string) {
        const focusSpanElement = document.querySelector(
            `#layouts div.file-tree.sy__file > div.block__icons > span[data-type="focus"]`,
        ) as HTMLElement;

        if (focusSpanElement) {
            // 暂时不聚焦一级文档树。
            // focusSpanElement.click();
        }
        // 实现双击进入这个路径
        if (lockPath) {
            return;
        }
        let docItemInfo: DocumentTreeItemInfo;
        for (const docItem of documentItems) {
            if (docItem.fileBlock.id == blockId) {
                docItemInfo = docItem;
                break;
            }
        }
        if (docItemInfo) {
            let subFileCount = docItemInfo.fileBlock.subFileCount;
            if (subFileCount === undefined || subFileCount === null) {
                let docInfo = await getDocInfo(blockId);
                subFileCount = docInfo.subFileCount;
            }
            if (subFileCount && subFileCount > 0) {
                let fileBlock = docItemInfo.fileBlock;
                switchPath(fileBlock.box, blockId, fileBlock.path);
            }
        }
    }

    function clearItemFocus() {
        rootElement
            .querySelectorAll("li.b3-list-item--focus")
            .forEach((liItem) => {
                liItem.classList.remove("b3-list-item--focus");
            });
    }

    function clearItemSelect() {
        rootElement
            .querySelectorAll("li.doc-item--select")
            .forEach((liItem) => {
                liItem.classList.remove("doc-item--select");
            });
    }

    async function openBlockTab(
        blockId: string,
        tabPosition: "right" | "bottom",
        actions?: TProtyleAction[],
    ) {
        if (isArrayEmpty(actions)) {
            actions = [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL];
        }

        if (EnvConfig.ins.isMobile) {
            openMobileFileById(EnvConfig.ins.app, blockId, actions);
        } else {
            openDestopBlockTab(actions, blockId, tabPosition);
        }
    }

    async function openDestopBlockTab(
        actions: TProtyleAction[],
        blockId: string,
        tabPosition: "right" | "bottom",
    ) {
        if (lastOpenBlockId == blockId) {
            previewProtyleMatchFocusIndex++;
        } else {
            previewProtyleMatchFocusIndex = -1;
        }
        lastOpenBlockId = blockId;
        // 优化定位，搜索出来打开，第一次打开不定位，这样默认会是上一次的界面，防止一点开就定位到开头。
        // 如果被查找节点不是聚焦状态，节点文档是当前查看文档，节点的文档element 存在，文档element 包含查找的节点
        let activeDocTab = getActiveTab();
        if (isArrayNotEmpty(lastKeywords) && activeDocTab) {
            let activeDocContentElement = activeDocTab.querySelector(
                "div.protyle-content",
            ) as HTMLElement;
            let activeNodeId = activeDocContentElement
                .querySelector("div.protyle-title.protyle-wysiwyg--attr")
                ?.getAttribute("data-node-id");
            if (activeNodeId == blockId) {
                let matchFocusRangePromise = highlightElementTextByCss(
                    activeDocContentElement,
                    lastKeywords,
                    previewProtyleMatchFocusIndex,
                );
                if (previewProtyleMatchFocusIndex >= 0) {
                    matchFocusRangePromise.then((focusRange) => {
                        renderNextSearchMarkByRange(focusRange);
                    });
                }
                return;
            }
        }
        let docTabPromise: Promise<ITab> = openTab({
            app: EnvConfig.ins.app,
            doc: {
                id: blockId,
                action: actions,
            },
            position: tabPosition,
            afterOpen() {
                afterOpenDocTab(docTabPromise);
            },
        });
    }

    async function docListSelectCurDoc() {
        let docId;
        let notebookId;
        let parentDocPath;
        let parentDocId;
        if (EnvConfig.ins.isMobile) {
            if (window.siyuan.mobile.editor) {
                let protyle = window.siyuan.mobile.editor.protyle;
                if (!protyle) {
                    return;
                }
                docId = protyle.block.rootID;
                notebookId = protyle.notebookId;
                // 这里需要取打开文档的父级文档和路径。
                parentDocPath = getParentPath(protyle.path);
                parentDocId = getDocIdByPath(parentDocPath);
            }
        } else {
            let protyle = getDesktopCurDocProtyle();
            if (!protyle) {
                return;
            }
            docId = protyle.block.id;
            notebookId = protyle.notebookId;
            // 这里需要取打开文档的父级文档和路径。
            parentDocPath = getParentPath(protyle.path);
            parentDocId = getDocIdByPath(parentDocPath);
        }
        clearItemFocus();
        clearItemSelect();

        await switchPath(notebookId, parentDocId, parentDocPath);
        docListSelectDocById(docId);
    }

    function docListSelectDocById(docId: string) {
        const docLiElement = rootElement.querySelector(
            `li[data-node-id="${docId}"]`,
        ) as HTMLElement;
        if (!docLiElement) {
            return;
        }
        docLiElement.classList.add("b3-list-item--focus");

        let docListElement = docLiElement.parentElement.parentElement;
        let docOffsetTop = docLiElement.offsetTop - docListElement.offsetTop;

        if (
            docOffsetTop >
            docListElement.clientHeight +
                docListElement.scrollTop -
                docLiElement.clientHeight * 4
        ) {
            docListElement.scrollTop =
                docOffsetTop -
                docListElement.clientHeight +
                docLiElement.clientHeight * 5;
        } else if (
            docOffsetTop <
            docListElement.scrollTop + docLiElement.clientHeight * 3
        ) {
            docListElement.scrollTop =
                docOffsetTop - docLiElement.clientHeight * 3;
        }
    }

    function getDocIdByPath(path: string) {
        if (isStrBlank(path)) {
            return null;
        }
        // 将路径按斜杠分割
        const parts = path.split("/");

        if (parts.length < 1) {
            return null; // 如果没有多余的路径部分，返回根路径
        }
        let docId = parts[parts.length - 1];
        docId = docId.replace(".sy", "");
        return docId;
    }

    async function switchShowSubDocOfSubDoc() {
        localShowSubDocOfSubDoc = !localShowSubDocOfSubDoc;
        refreshDocList();
    }

    async function switchFullTextSearch() {
        localFullTextSearch = !localFullTextSearch;
        refreshDocList();
    }

    async function refreshDocListBySearchKey(searchKey: string) {
        await updateDocList(
            curPathNotebookId,
            curPathDocId,
            curPathDocPath,
            searchKey,
            curPathSortMethod,
        );
    }

    async function refreshDocListByDocSort(docSortMethod: DocumentSortMode) {
        await updateDocList(
            curPathNotebookId,
            curPathDocId,
            curPathDocPath,
            searchInputKey,
            docSortMethod,
        );
    }

    async function refreshDocList() {
        // 先清空
        // let docListElement = rootElement.querySelector("div.doc_list--content");
        // docListElement.innerHTML = "";
        await updateDocList(
            curPathNotebookId,
            curPathDocId,
            curPathDocPath,
            searchInputKey,
            curPathSortMethod,
        );
        if (isStrBlank(waitRefreshSelectDocId)) {
            docListSelectDocById(waitRefreshSelectDocId);
            waitRefreshSelectDocId = null;
        }
    }

    async function updateDocList(
        notebookId: string,
        parentDocId: string,
        docPath: string,
        searchKey: string,
        docSortMethod: DocumentSortMode,
    ) {
        // let settingConfig = SettingService.ins.SettingConfig;
        let showSubDocuments = localShowSubDocOfSubDoc;
        let fullTextSearch = localFullTextSearch;
        // let fullTextSearch = settingConfig.fullTextSearch;
        let keywords = splitKeywordStringToArray(searchKey);

        waitRefreshByDatabase = false;

        lastSelectDocItemIndex = -1;
        // 每次查询改为1，防止因为异常，加载图案不会消失。
        isSearching = 1;
        lastKeywords = keywords;

        let useDocByPathApi = isQueryDocByPathApi(
            showSubDocuments,
            notebookId,
            docPath,
            keywords,
            fullTextSearch,
        );

        updateCurPath(parentDocId);

        if (useDocByPathApi) {
            if (docSortMethod == curNotebookSortMethod) {
                docSortMethod = null;
            }

            await queryDocumentByPath(
                notebookId,
                docPath,
                keywords,
                docSortMethod,
            ).then((docTreeInfoArray) => {
                documentItems = docTreeInfoArray;
                isSearching = Math.max(0, isSearching - 1);
            });
        } else {
            if (
                isStrBlank(docSortMethod) ||
                docSortMethod.startsWith("Custom") ||
                docSortMethod.startsWith("Size") ||
                docSortMethod.startsWith("FileTree")
                // || (docSortMethod.startsWith("SubDoc") && isStrBlank(notebookId))
            ) {
                docSortMethod =
                    SettingService.ins.SettingConfig.defaultDbQuerySortOrder;

                curPathSortMethod = docSortMethod;
            }

            await queryDocumentByDb(
                notebookId,
                parentDocId,
                docPath,
                keywords,
                showSubDocuments,
                localFullTextSearch,
                docSortMethod,
            ).then((docTreeInfoArray) => {
                documentItems = docTreeInfoArray;
                isSearching = Math.max(0, isSearching - 1);
            });
        }
    }

    async function updateCurPath(parentDocId: string) {
        let showCurPathTemp = `<span class="doc-path" style="font-size:1.4em" data-siwtch-notebook>/</span>`;

        if (isStrNotBlank(parentDocId)) {
            let parentDocInfo = await getBlockByID(parentDocId);
            showCurPathTemp = getBoxIconAndNameHtml(parentDocInfo.box);
            let hpathSplit = parentDocInfo.hpath.split("/");
            let pathSplit = parentDocInfo.path.split("/");
            for (let i = 1; i < hpathSplit.length; i++) {
                showCurPathTemp += `<span class="doc-path" data-path-type="doc" data-id="${pathSplit[i].replace(".sy", "")}">/${hpathSplit[i]}</span>`;
            }
        } else if (isStrNotBlank(curPathNotebookId)) {
            showCurPathTemp = getBoxIconAndNameHtml(curPathNotebookId);
        }

        showCurPath = showCurPathTemp;
    }

    function getBoxIconAndNameHtml(box: string) {
        if (isStrBlank(box)) {
            return "";
        }
        let notebook = EnvConfig.ins.notebookMap.get(box);
        if (!notebook) {
            return "";
        }

        // let icon = getNotebookIcon(notebook.icon);

        // let iconHtml = `<span class="box-path__icon doc-path" style="font-size:1.1em"  data-siwtch-notebook>${icon}</span>`;
        // let nameHtml = `<span class="doc-path" data-path-type="box" data-id="${box}"> ${notebook.name}</span>`;
        let boxPathHtml = getBoxIconAndNameHtmlByNotebook(notebook);

        return boxPathHtml;
    }

    function getBoxIconAndNameHtmlByNotebook(notebook: INotebook) {
        if (!notebook) {
            return "";
        }
        let icon = getNotebookIcon(notebook.icon);

        let iconHtml = `<span class="box-path__icon doc-path" style="font-size:1.1em"  data-siwtch-notebook>${icon}</span>`;
        let nameHtml = `<span class="doc-path" data-path-type="box" data-id="${notebook.id}"> ${notebook.name}</span>`;
        let boxPathHtml = iconHtml + nameHtml;

        return boxPathHtml;
    }

    function handleKeyDownSelectItem(event: KeyboardEvent) {
        const selectedItem = selectItemByArrowKeys(
            event,
            lastSelectDocItemIndex,
            documentItems,
        );

        if (selectedItem) {
            clearItemSelect();
            docListSelectDocById(selectedItem.fileBlock.id);

            updateFocusStyles(event, selectedItem.index);
            lastSelectDocItemIndex = selectedItem.index;

            if (event.key === "Enter") {
                openBlockTab(selectedItem.fileBlock.id, null);
            }
        }
    }

    function updateFocusStyles(event: KeyboardEvent, newIndex: number) {
        documentItems.forEach((item) => {
            const element = rootElement.querySelector(
                `li[data-node-id="${item.fileBlock.id}"]`,
            );

            if (element) {
                if (!event.shiftKey && item.index === lastSelectDocItemIndex) {
                    element.classList.remove("b3-list-item--focus");
                }
                if (item.index === newIndex) {
                    element.classList.add(
                        "b3-list-item--focus",
                        "doc-item--select",
                    );
                }
            }
        });
    }

    function handleSearchInputChange(event) {
        // console.log("handleSearchInputChange searchInputKey ", searchInputKey);
        // if (event.isComposing) {
        //     return;
        // }
        let inputValue = event.target.value;
        if (searchInputKey == inputValue) {
            return;
        }

        // 更新输入值
        // searchInputKey = inputValue;
        // 清除之前的定时器
        clearTimeout(inputChangeTimeoutId);

        inputChangeTimeoutId = setTimeout(() => {
            refreshDocListBySearchKey(inputValue);
        }, 256);
    }

    /**
     * 
定位当前打开的文档 — ALT + D; Document
锁定(解锁)路径 — ALT + Q
锁定(解锁)排序方式 — ALT + W
显示(隐藏)子文件夹 — ALT + E
开启(关闭)全文搜索 — ALT + R
     * @param event
     */
    function handleSearchInputKeydown(event) {
        // console.log("handleSearchInputKeydown");

        // 检查按键是否是 Alt + F
        if (event.altKey && event.key === "d") {
            event.preventDefault();
            event.stopPropagation();

            docListSelectCurDoc();
        } else if (event.altKey && event.key === "q") {
            event.preventDefault();
            event.stopPropagation();

            lockPath = !lockPath;
        } else if (event.altKey && event.key === "w") {
            event.preventDefault();
            event.stopPropagation();

            lockSortOrder = !lockSortOrder;
        } else if (event.altKey && event.key === "e") {
            event.preventDefault();
            event.stopPropagation();

            switchShowSubDocOfSubDoc();
        } else if (event.altKey && event.key === "r") {
            event.preventDefault();
            event.stopPropagation();

            switchFullTextSearch();
        }
    }

    function clearDocumentSearchInput() {
        searchInputKey = "";
        refreshDocListBySearchKey(searchInputKey);
        clearCssHighlights();
    }
    function handleKeyDownDefault() {}

    async function afterOpenDocTab(docTabPromise: Promise<ITab>) {
        if (isArrayEmpty(lastKeywords)) {
            return;
        }
        previewProtyleMatchFocusIndex = -1;
        let docTab = await docTabPromise;
        let lastDocumentContentElement = docTab.panelElement
            .children[1] as HTMLElement;

        delayedTwiceRefresh(() => {
            highlightElementTextByCss(
                lastDocumentContentElement,
                lastKeywords,
                null,
            );
        }, 50);
    }

    // function renderFirstSearchMarkByRange(matchRange: Range) {
    //     scrollByRange(matchRange, "nearest");
    // }

    function renderNextSearchMarkByRange(matchRange: Range) {
        scrollByRange(matchRange, "center");
    }

    /**拖拽*/
    function docListDragoverEvent(event: any) {
        event.preventDefault();
        event.stopPropagation();
        // 默认允许拖拽
        event.dataTransfer.dropEffect = "move";
        if (
            window.siyuan.config.readonly ||
            event.dataTransfer.types.includes(Constants.SIYUAN_DROP_TAB)
        ) {
            return;
        }

        // 不支持块标拖拽
        for (const item of event.dataTransfer.items) {
            if (item.type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
                event.dataTransfer.dropEffect = "none";
                return;
            }
        }

        let syFileTreeElement = document.querySelector(
            "div.file-tree.sy__file > div.fn__flex-1 ",
        );
        if (!syFileTreeElement) {
            event.dataTransfer.dropEffect = "none";
            return;
        }

        // 如果拖拽元素存在笔记本
        let syFileTreeFocusLiElemntArray = syFileTreeElement.querySelectorAll(
            ".b3-list-item--focus",
        );
        for (const item of syFileTreeFocusLiElemntArray) {
            let liType = (item as HTMLElement).getAttribute("data-type");
            if (liType === "navigation-root") {
                event.dataTransfer.dropEffect = "none";
                return;
            }
        }

        const thisElement = event.currentTarget as HTMLElement;
        let docListTopElement = hasClosestBySelector(
            event.target,
            "div.doc_list--top",
        );
        let liElement = hasClosestByTag(event.target, "LI");
        if (!liElement) {
            liElement = hasClosestByTag(
                document.elementFromPoint(event.clientX, event.clientY - 1),
                "LI",
            );
        }
        liElement = liElement as HTMLElement;

        if ((!docListTopElement && !liElement) || !window.siyuan.dragElement) {
            event.dataTransfer.dropEffect = "none";
            return;
        }

        removeDocListDragClass(thisElement);
        if (docListTopElement) {
            if (!curPathNotebookId && !curPathDocId && !curPathDocPath) {
                event.dataTransfer.dropEffect = "none";
                return;
            }
            docListTopElement.classList.add("misuzu2027__dragover");
        } else if (liElement) {
            liElement.classList.add("misuzu2027__dragover");
        }

        let docListContentElement =
            thisElement.querySelector(".doc_list--content");

        let customSort =
            curPathSortMethod === "Custom" && !localShowSubDocOfSubDoc;
        const SIZE_SCROLL_TB = 32;
        const MIN_SCROLL_STEP = 5;
        const SIZE_SCROLL_STEP = 200;
        const contentRect = docListContentElement.getBoundingClientRect();

        let newScrollTop = 0;
        if (event.clientY < contentRect.top + SIZE_SCROLL_TB) {
            let ratio =
                (contentRect.top + SIZE_SCROLL_TB - event.clientY) /
                SIZE_SCROLL_TB;
            newScrollTop =
                docListContentElement.scrollTop -
                Math.max(MIN_SCROLL_STEP, ratio * SIZE_SCROLL_STEP);
        } else if (event.clientY > contentRect.bottom - SIZE_SCROLL_TB) {
            let ratio =
                (event.clientY - (contentRect.bottom - SIZE_SCROLL_TB)) /
                SIZE_SCROLL_TB;
            newScrollTop =
                docListContentElement.scrollTop +
                Math.max(MIN_SCROLL_STEP, ratio * SIZE_SCROLL_STEP);
        }
        if (newScrollTop !== 0) {
            docListContentElement.scroll({
                top: newScrollTop,
                behavior: "smooth",
            });
        }

        if (customSort && liElement) {
            const nodeRect = liElement.getBoundingClientRect();
            const dragHeight = nodeRect.height * 0.2;
            if (event.clientY > nodeRect.bottom - dragHeight) {
                (liElement as HTMLElement).classList.add("dragover__bottom");
                liElement.classList.remove("misuzu2027__dragover");
            } else if (event.clientY < nodeRect.top + dragHeight) {
                (liElement as HTMLElement).classList.add("dragover__top");
                liElement.classList.remove("misuzu2027__dragover");
            }
        }
    }
    let dragenterCounter = 0;
    function docListDragleaveEvent(event: any) {
        // event.preventDefault();
        // event.dataTransfer.dropEffect = "move";
        dragenterCounter--;
        if (dragenterCounter <= 1) {
            const thisElement = event.currentTarget as HTMLElement;
            removeDocListDragClass(thisElement);
        }
    }
    function docListDragenterEvent(event: any) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        dragenterCounter++;
    }

    async function docListDropEvent(event: any) {
        const thisElement = event.currentTarget as HTMLElement;

        let newElement = thisElement.querySelector(
            ".misuzu2027__dragover, .dragover__bottom, .dragover__top",
        );

        if (!newElement) {
            return;
        }
        newElement = newElement as HTMLElement;

        // 不支持块标拖拽
        for (const item of event.dataTransfer.items) {
            if (item.type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
                event.dataTransfer.dropEffect = "none";
                return;
            }
        }
        window.siyuan.dragElement = undefined;
        // if (!event.dataTransfer.getData(Constants.SIYUAN_DROP_FILE)) {
        //     removeDocListDragClass(thisElement);
        //     return;
        // }

        let syFileTreeElement = document.querySelector(
            "div.file-tree.sy__file > div.fn__flex-1 ",
        );
        if (!syFileTreeElement) {
            event.dataTransfer.dropEffect = "none";
            return;
        }

        let syFileTreeFocusLiElemntArray = syFileTreeElement.querySelectorAll(
            ".b3-list-item--focus",
        );
        if (!syFileTreeFocusLiElemntArray) {
            return;
        }

        let toNotebookId = curPathNotebookId;
        let toPath = curPathDocPath;
        if (newElement.tagName == "LI") {
            const newUlElement = hasTopClosestByTag(newElement, "UL");
            if (!newUlElement) {
                return;
            }
            toNotebookId = newUlElement.getAttribute("data-url");
            if (newElement.classList.contains("misuzu2027__dragover")) {
                toPath = newElement.getAttribute("data-path");
            }
        }

        const selectFileElements: HTMLElement[] = [];
        const fromPaths: string[] = [];

        syFileTreeFocusLiElemntArray.forEach((item: HTMLElement) => {
            if (item.getAttribute("data-type") !== "navigation-file") {
                return;
            }
            const dataPath = item.getAttribute("data-path");
            const isChild = fromPaths.find((itemPath) => {
                if (dataPath.startsWith(itemPath.replace(".sy", ""))) {
                    return;
                }
            });
            if (!isChild) {
                // 禁止父节点移动到子节点 https://github.com/siyuan-note/siyuan/issues/12539
                if (toPath.startsWith(item.dataset.path.replace(".sy", ""))) {
                    return;
                }
                selectFileElements.push(item as HTMLElement);
                fromPaths.push(dataPath);
            }
        });

        let customSort =
            curPathSortMethod === "Custom" && !localShowSubDocOfSubDoc;

        let changSortUpdate =
            customSort &&
            (newElement.classList.contains("dragover__bottom") ||
                newElement.classList.contains("dragover__top"));

        if (!changSortUpdate) {
            if (isArrayNotEmpty(fromPaths)) {
                await moveDocs(fromPaths, toNotebookId, toPath);
                refreshDocList();
            }
        } else {
            let hasMove = false;
            const toDir = pathPosix().dirname(toPath);
            let oldDocumentItemsTemp = [...documentItems];
            if (fromPaths.length > 0) {
                moveDocs(
                    fromPaths,
                    toNotebookId,
                    toPath,
                    Constants.CB_MOVE_NOLIST,
                );
                selectFileElements.forEach((item) => {
                    item.setAttribute(
                        "data-path",
                        pathPosix().join(
                            toDir,
                            item.getAttribute("data-node-id") + ".sy",
                        ),
                    );
                });
                hasMove = true;
            }
            // 因为用的 svelte 框架，所以不能直接修改页面元素，添加或修改顺序需要往 oldDocumentItemsTemp 数组中丢
            let newElementNodeId = newElement.getAttribute("data-node-id");
            let newDocumentItems: DocumentTreeItemInfo[] = [];
            let selectDocumentItem: DocumentTreeItemInfo[] = [];
            let selectDocumentId: string[] = [];
            selectFileElements.forEach((item) => {
                let itemNodeId = item.getAttribute("data-node-id");
                let nameElement = item.querySelector(
                    "span.b3-list-item__text.ariaLabel",
                );
                let iconElement = item.querySelector("span.b3-list-item__icon");
                let refCountElement = item.querySelector(
                    "span.popover__block.counter",
                );
                let refCount = refCountElement?.textContent
                    ? Number(refCountElement.textContent)
                    : 0;
                let subFileCount = item.getAttribute("data-count")
                    ? Number(item.getAttribute("data-count"))
                    : 0;
                let created = itemNodeId.split("-")[0];
                let itemInfo: DocumentTreeItemInfo = new DocumentTreeItemInfo();
                itemInfo.ariaLabel = nameElement?.getAttribute("aria-label");
                itemInfo.icon = iconElement?.outerHTML;
                itemInfo.refCount = refCount;
                itemInfo.fileBlock = {
                    id: itemNodeId,
                    box: curPathNotebookId,
                    content: nameElement.textContent,
                    name: null,
                    alias: null,
                    memo: null,
                    path: item.getAttribute("data-path"),
                    refCount: refCount,
                    subFileCount: subFileCount,
                    sort: 0,
                    created: created,
                    updated: created,
                };

                selectDocumentItem.push(itemInfo);
                selectDocumentId.push(itemNodeId);
            });

            // 遍历原数组
            let inserted = false; // 标记是否已经插入过元素
            for (let i = 0; i < oldDocumentItemsTemp.length; i++) {
                let docItemTemp = oldDocumentItemsTemp[i];
                // 如果移动的文档已经在原目录下存在，需要过滤掉，否则会干扰顺序。
                if (selectDocumentId.includes(docItemTemp.fileBlock.id)) {
                    continue;
                }
                // 检查当前元素是否满足插入条件
                if (
                    !inserted &&
                    oldDocumentItemsTemp[i].fileBlock.id == newElementNodeId
                ) {
                    if (newElement.classList.contains("dragover__top")) {
                        inserted = true; // 标记已插入
                        newDocumentItems.push(...selectDocumentItem);
                        newDocumentItems.push(docItemTemp);
                        continue;
                    } else if (
                        newElement.classList.contains("dragover__bottom")
                    ) {
                        inserted = true; // 标记已插入
                        newDocumentItems.push(docItemTemp);
                        newDocumentItems.push(...selectDocumentItem);
                        continue;
                    }
                }

                // 将当前元素添加到结果数组
                newDocumentItems.push(oldDocumentItemsTemp[i]);
            }
            // 如果遍历完数组后还没有插入元素，说明没有满足条件的位置，直接插入
            if (!inserted) {
                newDocumentItems.push(...selectDocumentItem);
            }
            // documentItems = newDocumentItems;

            const paths: string[] = [];

            for (const docItem of newDocumentItems) {
                paths.push(docItem.fileBlock.path);
            }

            await changeSort(toNotebookId, paths);
            if (hasMove) {
                let path = toDir === "/" ? "/" : toDir + ".sy";
                let data = await listDocsByPath(
                    toNotebookId,
                    path,
                    null,
                    null,
                    null,
                    null,
                );
                if (data.path === "/" && data.files.length === 0) {
                    showMessage(window.siyuan.languages.emptyContent);
                    return;
                }
                await refreshDocList();
                // thisElement.scrollTop = oldScrollTop;
            }
        }
        removeDocListDragClass(thisElement);
    }

    function removeDocListDragClass(docListElemnt: HTMLElement) {
        if (!docListElemnt) {
            return;
        }
        docListElemnt.classList.remove("misuzu2027__dragover");
        docListElemnt
            .querySelectorAll(
                ".misuzu2027__dragover, .dragover__bottom, .dragover__top",
            )
            .forEach((item: HTMLElement) => {
                item.classList.remove(
                    "misuzu2027__dragover",
                    "dragover__bottom",
                    "dragover__top",
                );
            });
    }

    function docListItemDragstartEvent(event: any) {
        let syFileTreeElement = document.querySelector(
            "div.file-tree.sy__file > div.fn__flex-1 ",
        );
        if (!syFileTreeElement) {
            return;
        }
        // 清除可能存在的拖拽遗留数据
        window.siyuan.dragElement = undefined;
        document
            .querySelectorAll(".misuzu-drag-hide-doc-list")
            .forEach((item) => {
                item.remove();
            });
        clearSyFileTreeItemFocusClass();

        // 下面全抄官方的，把 this.element 换成了 rootElement
        // https://github.com/siyuan-note/siyuan/blob/f3b0ee51d5fb505c852c7378ba85776d15e22b86/app/src/layout/dock/Files.ts#L371
        event as DragEvent & { target: HTMLElement };
        if (isTouchDevice()) {
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        window.getSelection().removeAllRanges();
        const liElement = hasClosestByTag(event.target, "LI");
        if (liElement) {
            let selectElements: Element[] = Array.from(
                rootElement.querySelectorAll(".b3-list-item--focus"),
            );
            if (!liElement.classList.contains("b3-list-item--focus")) {
                selectElements.forEach((item) => {
                    item.classList.remove("b3-list-item--focus");
                });
                liElement.classList.add("b3-list-item--focus");
                selectElements = [liElement];
            }
            let ids = "";
            const ghostElement = document.createElement("ul");
            selectElements.forEach((item: HTMLElement, index) => {
                ghostElement.append(item.cloneNode(true));
                item.style.opacity = "0.1";
                const itemNodeId = item.dataset.nodeId || item.dataset.path; // 拖拽笔记本时值不能为空，否则 drop 就不会继续排序
                if (itemNodeId) {
                    ids += itemNodeId;
                    if (index < selectElements.length - 1) {
                        ids += ",";
                    }
                }
                // 关键代码：克隆节点，添加到文档树节点内；这样就可以在拖拽结束后被官方代码查询到并实现业务。
                let hideListElement = item.cloneNode(true) as HTMLElement;
                hideListElement.style.display = "none";
                hideListElement.classList.add("misuzu-drag-hide-doc-list");
                syFileTreeElement.append(hideListElement);
            });
            ghostElement.setAttribute(
                "style",
                `width: 219px;position: fixed;top:-${selectElements.length * 30}px`,
            );
            ghostElement.setAttribute("class", "b3-list b3-list--background");
            document.body.append(ghostElement);
            event.dataTransfer.setDragImage(ghostElement, 16, 16);
            event.dataTransfer.setData(Constants.SIYUAN_DROP_FILE, ids);
            event.dataTransfer.dropEffect = "move";
            window.siyuan.dragElement = document.createElement("div");
            window.siyuan.dragElement.innerText = ids;
            setTimeout(() => {
                ghostElement.remove();
            });
        }
    }

    function docListItemDragendEvent() {
        // 官方代码
        // https://github.com/siyuan-note/siyuan/blob/f3b0ee51d5fb505c852c7378ba85776d15e22b86/app/src/layout/dock/Files.ts#L415
        rootElement
            .querySelectorAll(".b3-list-item--focus")
            .forEach((item: HTMLElement) => {
                item.style.opacity = "";
            });
        window.siyuan.dragElement = undefined;
        // 清除临时节点数据。
        document
            .querySelectorAll(".misuzu-drag-hide-doc-list")
            .forEach((item) => {
                item.remove();
            });
    }

    function localIsQueryDocByPathApi(): boolean {
        let showSubDocuments = localShowSubDocOfSubDoc;
        let fullTextSearch = SettingService.ins.SettingConfig.fullTextSearch;

        return isQueryDocByPathApi(
            showSubDocuments,
            curPathNotebookId,
            curPathDocPath,
            lastKeywords,
            fullTextSearch,
        );
    }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<!-- svelte-ignore a11y-label-has-associated-control -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div
    class="fn__flex-column misuzu2027__doc-list"
    style="height: 100%;width: calc(100% - 7px);"
    tabindex="0"
    bind:this={rootElement}
    on:keydown={handleSearchInputKeydown}
    on:dragover={docListDragoverEvent}
    on:dragleave={docListDragleaveEvent}
    on:dragenter={docListDragenterEvent}
    on:drop={docListDropEvent}
>
    <div class="doc_list--top">
        <div
            class="block__icons"
            style="overflow: auto;flex-wrap: wrap;height:auto"
        >
            <div>
                <span class="counter-badge ariaLabel" aria-label="当前文档数量"
                    >{documentItems.length}</span
                >
            </div>
            <span class="fn__flex-1 fn__space"></span>
            <span
                class="block__icon ariaLabel"
                aria-label="定位打开的文档 "
                style="opacity: 1;"
                on:click={docListSelectCurDoc}
                on:keydown={handleKeyDownDefault}
                ><svg><use xlink:href="#iconFocus"></use></svg></span
            >
            <span class="fn__space"></span>
            <span class="fn__space"></span>
            <label
                class="block__icon ariaLabel {lockPath ? 'label-selected' : ''}"
                aria-label="锁定当前路径 "
                style="opacity: 1;"
                on:click={() => {
                    lockPath = !lockPath;
                }}
                on:keydown={handleKeyDownDefault}
                ><svg><use xlink:href="#iconLockPath"></use></svg>
                <!-- <span class="fn__space"></span> -->
                <!-- <input
                    class="b3-switch fn__flex-center"
                    type="checkbox"
                    bind:checked={lockPath}
                /> -->
            </label>
            <span class="fn__space"></span>
            <label
                class="block__icon ariaLabel {lockSortOrder
                    ? 'label-selected'
                    : ''}"
                aria-label="锁定排序方式"
                style="opacity: 1;"
                on:click={() => {
                    lockSortOrder = !lockSortOrder;
                }}
                on:keydown={handleKeyDownDefault}
                ><svg><use xlink:href="#iconLockSort"></use></svg>
                <!-- <span class="fn__space"></span> -->
                <!-- <input
                    class="b3-switch fn__flex-center"
                    type="checkbox"
                    bind:checked={lockSortOrder}
                /> -->
            </label>

            <span class="fn__space"></span>
            <label
                class="block__icon ariaLabel {localShowSubDocOfSubDoc
                    ? 'label-selected'
                    : ''}"
                aria-label="显示子文档的子文档"
                style="opacity: 1;"
                on:click={switchShowSubDocOfSubDoc}
                on:keydown={handleKeyDownDefault}
                ><svg><use xlink:href="#iconShowSubDoc"></use></svg>

                <!-- <span class="fn__space"></span> -->

                <!-- <input
                    class="b3-switch fn__flex-center"
                    type="checkbox"
                    bind:checked={showSubDocOfSubDoc}
                    on:click={switchShowSubDocOfSubDoc}
                /> -->
            </label>
            <span class="fn__space"></span>
            <label
                class="block__icon ariaLabel {localFullTextSearch
                    ? 'label-selected'
                    : ''}"
                aria-label="使用全文搜索"
                style="opacity: 1;"
                on:click={switchFullTextSearch}
                on:keydown={handleKeyDownDefault}
                ><svg><use xlink:href="#iconFullTextSearch"></use></svg>

                <!-- <span class="fn__space"></span> -->
            </label>
        </div>
        <!-- 路径信息 -->
        <div
            class="scroll-container"
            style="padding-left:8px"
            on:touchmove|stopPropagation={() => {}}
        >
            {@html showCurPath}
        </div>

        <!-- 排序方式 -->
        <div
            class="block__icons"
            style="overflow: auto;flex-wrap: wrap;height:auto"
        >
            <div style="display:flex;padding:3px 2px;">
                <!-- <span style="display: flex;align-items: center;padding:5px;"
                    >{EnvConfig.ins.i18n.sort}:
                </span> -->
                <select
                    class="b3-select fn__flex-center"
                    on:change={documentSortMethodChange}
                    bind:value={curPathSortMethod}
                    style="width:110px"
                >
                    {#each SETTING_DOCUMENT_LIST_SORT_METHOD_ELEMENT() as element}
                        <option
                            value={element.value}
                            selected={element.value == curPathSortMethod}
                        >
                            {element.text}
                        </option>
                    {/each}
                </select>
            </div>
            <div class="fn__space"></div>
            <div>
                <button
                    class="b3-button b3-button--outline fn__flex-center fn__size200"
                    style="width: 50px;font-size: 70%;padding:3px"
                    on:click={showAllDoc}
                    on:contextmenu={siwtchDefaultPath}
                    >全部文档
                </button>
            </div>
            <div class="fn__space"></div>
            <button
                class="misuzu2027__icon-btn
                {backPathButtonEnable ? '' : 'misuzu2027__icon-btn--disabled'}"
                on:click={backPath}
                on:contextmenu={forwardPath}
            >
                <svg><use xlink:href="#iconBack"></use></svg>
            </button>
        </div>
        <!-- 搜索框 -->
        <div
            class="b3-form__icon search__header"
            on:keydown={handleKeyDownSelectItem}
        >
            <div style="position: relative" class="fn__flex-1">
                <span>
                    <svg data-menu="true" class="b3-form__icon-icon">
                        <use xlink:href="#iconSearch"></use>
                    </svg>
                </span>
                <input
                    class="b3-text-field b3-text-field--text misuzu2027__dual-doc-list__search-input"
                    style="padding-left: 32px !important;padding-right: 32px !important;"
                    on:input={handleSearchInputChange}
                    bind:value={searchInputKey}
                />
                <svg
                    class="b3-form__icon-clear ariaLabel {searchInputKey == ''
                        ? 'fn__none'
                        : ''}"
                    aria-label={EnvConfig.ins.i18n.clear}
                    style="right: 8px;height:42px"
                    on:click|stopPropagation={clearDocumentSearchInput}
                    on:keydown={handleKeyDownDefault}
                >
                    <use xlink:href="#iconCloseRound"></use>
                </svg>
            </div>
            <div class="block__icons">
                <span
                    id="documentSearchRefresh"
                    aria-label={EnvConfig.ins.i18n.refresh}
                    class="block__icon ariaLabel"
                    data-position="9bottom"
                    on:click|stopPropagation={() => {
                        refreshDocList();
                    }}
                    on:keydown={handleKeyDownDefault}
                >
                    <svg><use xlink:href="#iconRefresh"></use></svg>
                </span>
            </div>
        </div>
    </div>
    <div class="fn__flex-1 doc_list--content">
        <div style="height: 4px;"></div>
        {#each documentItems as item}
            <ul
                class="b3-list b3-list--background file-tree"
                data-url={item.fileBlock.box}
            >
                <li
                    data-node-id={item.fileBlock.id}
                    data-name={escapeHTML(item.fileBlock.content) + ".sy"}
                    data-block-name={escapeHTML(item.fileBlock.name)}
                    data-count={item.fileBlock.subFileCount}
                    data-type="navigation-file"
                    style="--file-toggle-width:40px;height:32px;padding:2px;"
                    class="b3-list-item b3-list-item--hide-action"
                    draggable={EnvConfig.ins.isMobile ? "false" : "true"}
                    data-path={item.fileBlock.path}
                    on:click={docItemClick}
                    on:keydown={handleKeyDownDefault}
                    on:dragstart={docListItemDragstartEvent}
                    on:dragend={docListItemDragendEvent}
                >
                    <!-- {#if item.fileBlock.subFileCount > 0}
                        
                    {/if} -->
                    <span
                        class="b3-list-item__icon"
                        on:click={(event) => {
                            docIconClick(event, item);
                        }}
                        on:keydown={handleKeyDownDefault}
                    >
                        {@html item.icon}
                    </span>
                    <span
                        class="b3-list-item__text ariaLabel document-title"
                        data-position="parentE"
                        aria-label={item.ariaLabel}
                    >
                        {@html item.fileBlock.content}
                    </span>

                    <span
                        class="b3-list-item__action b3-tooltips b3-tooltips__nw"
                        aria-label="新建同级文档"
                        on:click={(event) => {
                            createSiblingDocClick(event, item);
                        }}
                        on:keydown={handleKeyDownDefault}
                    >
                        <svg><use xlink:href="#iconAdd"></use></svg>
                    </span>
                    {#if item.fileBlock.refCount}
                        <span
                            class="popover__block counter b3-tooltips b3-tooltips__nw"
                            aria-label={EnvConfig.ins.i18n.reference}
                            style=""
                        >
                            {item.fileBlock.refCount}
                        </span>
                    {/if}
                </li>
            </ul>
        {/each}
    </div>
</div>

<div
    class="fn__loading fn__loading--top {isSearching > 0 ? '' : 'fn__none'}"
    style="top:85px;width:48%"
>
    <!-- svelte-ignore a11y-missing-attribute -->
    <img width="120px" src="/stage/loading-pure.svg" />
</div>

<style lang="scss">
    /*面板标题*/
    .doc_list--top .block__icons {
        // min-height: 42px;
        // padding: 0 8px;
        white-space: nowrap; /* 强制子元素在同一行显示 */
        overflow-x: auto; /* 允许横向滚动 */
    }
    .scroll-container {
        // width: 300px; /* 设置容器的宽度 */
        white-space: nowrap; /* 强制子元素在同一行显示 */
        overflow-x: auto; /* 允许横向滚动 */
        user-select: text;
        min-height: 28px;
        padding: 0px 4px;
    }

    .counter-badge {
        // margin-left: 1px;
        display: inline-block;
        padding: 3px 3px;
        // background-color: #007bff; /* 椭圆的背景颜色 */

        font-size: 90%; /* 数字字体大小 */
        font-weight: bold;
        border-radius: 20px; /* 椭圆形状 */
        // min-width: 40px; /* 最小宽度 */
        text-align: center;
        // line-height: 1.5;
        vertical-align: middle;
        // box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); /* 添加阴影效果 */
    }

    // .block__icon {
    //     padding: 4px 1px;
    // }
    // label.block__icon span.fn__space {
    //     width: 4px;
    // }

    .misuzu2027__doc-list label.label-selected {
        // border: 1px solid #66ccff; rgba(102, 204, 255, 0.5)
        // box-shadow: inset 0 0 5px 2px var(--b3-theme-primary-light);
        background-color: var(--b3-theme-primary-light);
        transition: box-shadow 0.5s ease-in-out;
    }

    // .b3-switch:hover:not(:disabled):before,
    // .b3-switch:focus:not(:disabled):before {
    //     content: none;
    // }

    .misuzu2027__doc-list .doc_list--top .block__icon svg {
        height: 14px;
        width: 14px;
    }

    .misuzu2027__icon-btn {
        flex-shrink: 0;
        cursor: pointer;
        color: var(--b3-toolbar-color);
        padding: 5px;
        margin: 2px;
        border-radius: var(--b3-border-radius);
        box-sizing: border-box;
        transition: var(--b3-transition);
        display: flex;
        align-self: center;
        background-color: rgba(0, 0, 0, 0);
        border: 0;
        line-height: 13.5px;
        height: 23.5px;
    }

    .misuzu2027__icon-btn--disabled {
        opacity: 0.54;
        cursor: not-allowed;
    }

    .misuzu2027__icon-btn svg {
        height: 13.5px;
        width: 13.5px;
    }
</style>
