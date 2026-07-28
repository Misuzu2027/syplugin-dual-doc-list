import DocListSvelte from "@/components/doc-list/doc-list.svelte";
import DocListDockSvelte from "@/components/siyuan/dock/doc-list-dock.svelte";
import { EnvConfig } from "@/config/EnvConfig";
import { hasClosestBySelector } from "@/libs/siyuan/hasClosest";
import { CUSTOM_ICON_MAP } from "@/models/icon-constant";
import { SettingService } from "@/service/setting/SettingService";
import { setUILayout } from "@/utils/api";
import { convertTextToFirstElement, findParentElementWithAttribute, getAttributeRecursively } from "@/utils/html-util";
import Instance from "@/utils/Instance";
import { clearSyFileTreeItemFocusClass, isElementHidden } from "@/utils/siyuan-util";
import { MobileTabService } from "../plugin/MobileTabService";



export class DocListManager {


    public static get ins(): DocListManager {
        return Instance.get(DocListManager);
    }


    init() {
        this.initElementEventListener();
        this.initInterval();
        addDocListDock();
        MobileTabService.ins.init();
        // addObserveCommonMenuElement();
    }


    destroy() {
        this.destroyElementEventListener();
        this.destroyInterval();
        destroyEmbedDualDocList();
        MobileTabService.ins.destory();
        // destroyObserveCommonMenuElement();
    }


    initElementEventListener() {
        document.addEventListener('click', this.documentGlobeClickEvent, true);
    }

    destroyElementEventListener() {
        document.removeEventListener('click', this.documentGlobeClickEvent, true);
    }

    initInterval() {
        this.destroyInterval();
        if (EnvConfig.ins.isMobile) {
            return;
        }
        checkEmbedIntervalId = setInterval(() => intervalCheckEmbedDualDocList(), 800)
    }

    destroyInterval() {
        if (checkEmbedIntervalId) {
            clearInterval(checkEmbedIntervalId);
            checkEmbedIntervalId = null;
        }
    }

    refreshDocListDock(value: DockPosition) {
        window.location.reload();
        return;
        if (value === "Hidden") {
            destoryDocListDock();
        } else {
            addDocListDock();
        }

    }

    clickCount: number = 0;

    documentGlobeClickEvent = (event: MouseEvent) => {
        if (event.button != 0 || event.ctrlKey) {
            return;
        }
        if (EnvConfig.ins.isMobile) {
            this.mobileGlobeClickEvent(event);
        } else {
            this.desktopGlobeClickEvent(event);
        }
    }

    desktopGlobeClickEvent = (event: MouseEvent) => {
        let fileTreeDocElement = document.querySelector("#layouts  div.layout-tab-container div.file-tree.sy__file");
        let target = event.target as HTMLElement;

        if (!fileTreeDocElement || !fileTreeDocElement.contains(target)) {
            return;
        }
        const targetLiElement = findParentElementWithAttribute(target, ["navigation-file", "navigation-root"], 4);
        if (!targetLiElement || !target.classList.contains("b3-list-item__text")) return;

        let targetLiElementType = targetLiElement.getAttribute("data-type");
        if (targetLiElementType != "navigation-file" && targetLiElementType != "navigation-root") {
            return
        }

        // 如果是文档，但是不存在子文档。
        if (targetLiElementType == "navigation-file"
            && targetLiElement.querySelector("span.b3-list-item__toggle").classList.contains("fn__hidden")
        ) {
            return;
        }
        // 如果是笔记本，判断一下是否启用双击切换文档折叠。
        if (targetLiElementType == "navigation-root") {
            if (this.handleNotebookDoubleClick(event, targetLiElement)) {
                return;
            }
        }
        let notebookId: string = getAttributeRecursively(targetLiElement, "data-url");
        let docId: string = targetLiElement.getAttribute("data-node-id");
        let docPath: string = targetLiElement.getAttribute("data-path");

        this.handleSelectDoc(notebookId, docId, docPath)
    }

    mobileGlobeClickEvent = (event: MouseEvent) => {
        let fileTreeDocElement = document.querySelector(`#sidebar  div.fn__flex-column[data-type="sidebar-file"]`);
        let target = event.target as HTMLElement;

        if (!fileTreeDocElement || !fileTreeDocElement.contains(target)) {
            return;
        }
        const targetLiElement = findParentElementWithAttribute(target, ["navigation-file", "navigation-root"], 4);
        if (!targetLiElement || !target.classList.contains("b3-list-item__text")) return;

        let targetLiElementType = targetLiElement.getAttribute("data-type");
        if (targetLiElementType != "navigation-file" && targetLiElementType != "navigation-root") {
            return
        }

        // 如果是文档，但是不存在子文档(折叠按钮被隐藏了)
        if (targetLiElementType == "navigation-file"
            && targetLiElement.querySelector("span.b3-list-item__toggle").classList.contains("fn__hidden")
        ) {
            return;
        }
        // 如果是笔记本，判断一下是否启用双击切换文档折叠。
        if (targetLiElementType == "navigation-root" && (dockDocListSvelte || MobileTabService.ins.exist())) {
            if (this.handleNotebookDoubleClick(event, targetLiElement)) {
                return;
            }
        }

        let notebookId: string = getAttributeRecursively(targetLiElement, "data-url");
        let docId: string = targetLiElement.getAttribute("data-node-id");
        let docPath: string = targetLiElement.getAttribute("data-path");

        this.handleSelectDoc(notebookId, docId, docPath)
    }

    // return ： 是否双击
    private handleNotebookDoubleClick(event: MouseEvent, targetLiElement: HTMLElement): boolean {
        let settingConfig = SettingService.ins.SettingConfig;
        if (!settingConfig || !settingConfig.doubleClickToggleNotebook) {
            return false;
        }
        this.clickCount++;
        let doubleClickTimeout = settingConfig.doubleClickTimeout;
        if (this.clickCount < 2) {
            event.stopPropagation();
            event.preventDefault();
            setTimeout(() => {
                this.clickCount = 0;
            }, doubleClickTimeout);
            clearSyFileTreeItemFocusClass();
            targetLiElement.classList.add("b3-list-item--focus");
            return false;
        }
        return true;
    }


    handleSelectDoc(notebookId: string, docId: string, docPath: string) {

        if ((!docId && !notebookId)) {
            return;
        }

        if (embedDocListSvelte) {
            embedDocListSvelte.switchPath(notebookId, docId, docPath);
        }
        if (dockDocListSvelte) {
            dockDocListSvelte.switchPath(notebookId, docId, docPath);
        }
        MobileTabService.ins.switchPath(notebookId, docId, docPath);
    }

}


let checkEmbedIntervalId;

let embedDocListSvelte: DocListSvelte;

let dockDocListSvelte: DocListDockSvelte;

let firstLoadEmbedDualDocList: boolean = true;


const EmbedDualDocListElementAttrName = "data-misuzu2027-embed-dualDocList";

const DOC_LIST_DOCK_TYPE = "misuzu2027_doc_list_dock";

const SwitchEmbedDualDocListElementId = "misuzu2027_switch-embed-dual-doc-list";



function intervalCheckEmbedDualDocList() {
    let showFileTreeTopSwitchEmbedDualDocListButton = SettingService.ins.SettingConfig.showFileTreeTopSwitchEmbedDualDocListButton;
    if (showFileTreeTopSwitchEmbedDualDocListButton) {
        createSwitchEmbedDualDocListButtonForFileTreeTop();
    } else {
        destorySwitchEmbedDualDocListButtonForFileTreeTop();
    }
    let showEmbedDualDocList = SettingService.ins.SettingConfig.showEmbedDualDocList;
    let showEmbedDualDocListOnTablet = SettingService.ins.SettingConfig.showEmbedDualDocListOnTablet;
    // 判断是否为平板端
    if (EnvConfig.ins.isTablet) {
        // 平板端使用 showEmbedDualDocListOnTablet 配置
        if (showEmbedDualDocListOnTablet) {
            createEmbedDualDocList();
        } else {
            showEmbedDualDocListOnTablet = false;
            destroyEmbedDualDocList();
        }
    } else {
        // 非平板端使用 showEmbedDualDocList 配置
        if (showEmbedDualDocList) {
            createEmbedDualDocList();
        } else {
            firstLoadEmbedDualDocList = false;
            destroyEmbedDualDocList();
        }
    }

}

function createSwitchEmbedDualDocListButtonForFileTreeTop() {
    let fileTreeDocElement = document.querySelector("#layouts  div.layout-tab-container div.file-tree.sy__file");
    if (!fileTreeDocElement) {
        return;
    }

    if (fileTreeDocElement.querySelector(`#${SwitchEmbedDualDocListElementId}`)) {
        return;
    }
    let focusSpanElement = fileTreeDocElement.querySelector(`div.block__icons span[data-type="focus"]`)
    if (!focusSpanElement) {
        return;
    }

    let switchEmbedDualDocListSpanElement =
        convertTextToFirstElement(`<span data-type="switchEmbedDualDocList" id="${SwitchEmbedDualDocListElementId}" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="切换嵌入的二级文档列表"><svg><use xlink:href="#${CUSTOM_ICON_MAP.iconDualDocList.id}"></use></svg></span>`);
    let spanSpaceElement = convertTextToFirstElement(`<span class="fn__space"></span>`);
    focusSpanElement.parentElement.insertBefore(switchEmbedDualDocListSpanElement, focusSpanElement);
    switchEmbedDualDocListSpanElement.append(spanSpaceElement);
    switchEmbedDualDocListSpanElement.addEventListener("click", async (event) => {
        // event.stopPropagation();
        // event.preventDefault();
        let showEmbedDualDocList = SettingService.ins.SettingConfig.showEmbedDualDocList;
        await SettingService.ins.updateSettingCofnigValue("showEmbedDualDocList", !showEmbedDualDocList)
        intervalCheckEmbedDualDocList();
        window.siyuan.menus.menu.remove();
    })
}


function destorySwitchEmbedDualDocListButtonForFileTreeTop() {
    let fileTreeDocElement = document.querySelector("#layouts  div.layout-tab-container div.file-tree.sy__file");
    if (!fileTreeDocElement) {
        return;
    }
    let switchElement = fileTreeDocElement.querySelector(`#${SwitchEmbedDualDocListElementId}`);
    if (!switchElement) {
        return;
    }
    switchElement.remove();
}


function createEmbedDualDocList() {
    let fileTreeDocElement = document.querySelector("#layouts  div.layout-tab-container div.file-tree.sy__file");
    if (!fileTreeDocElement) {
        return;
    }
    let docTreeId = fileTreeDocElement.getAttribute("data-id");
    let dualDocListElement: HTMLElement = null;
    let oldDocListElementArray = document.querySelectorAll(`div.layout-tab-container div[${EmbedDualDocListElementAttrName}]`);

    if (oldDocListElementArray) {
        for (const element of oldDocListElementArray) {
            if (element.getAttribute("data-id") == docTreeId) {
                dualDocListElement = element as HTMLElement;
            } else {
                element.remove();
            }
        }
    }

    if (dualDocListElement) {
        return;
    }

    if (embedDocListSvelte) {
        embedDocListSvelte.$destroy();
        embedDocListSvelte = null;
    }

    let docListElement = getEmbedDualDocListElement();
    docListElement.setAttribute("data-id", docTreeId);
    if (isElementHidden(fileTreeDocElement)) {
        docListElement.classList.add("fn__none");
    }

    embedDocListSvelte = new DocListSvelte({
        target: docListElement,
        props: {
        }
    });

    let settingConfigEmbedDocListViewFlex = SettingService.ins.SettingConfig.embedDocListViewFlex;
    let embedDualDocListFlex = 1;
    if (!isNaN(settingConfigEmbedDocListViewFlex)) {
        embedDualDocListFlex = Number(settingConfigEmbedDocListViewFlex);
    }

    let dragHandleElement = getDragElement();

    let layoutDockElement = document.querySelector("div#layouts div.layout__dockl") as HTMLElement;

    if (layoutDockElement.contains(fileTreeDocElement)) {
        docListElement.insertBefore(dragHandleElement, docListElement.firstChild)
        fileTreeDocElement.after(docListElement);
    } else {
        layoutDockElement = document.querySelector("div#layouts div.layout__dockr") as HTMLElement;
        docListElement.append(dragHandleElement);
        fileTreeDocElement.before(docListElement);
    }
    // 设置焦点
    let searchInputElement = docListElement.querySelector("input.misuzu2027__dual-doc-list__search-input") as HTMLElement;
    if (searchInputElement) {
        searchInputElement.focus();
    }
    let layoutDockWidth = parseFloat(window.getComputedStyle(layoutDockElement).width);
    if (firstLoadEmbedDualDocList) {
        firstLoadEmbedDualDocList = false;
        let fileTreeWidth = findFileTreeWidth(window.siyuan.config.uiLayout);
        // console.log("window.siyuan.config.uiLayout fileTreeWidth", fileTreeWidth)
        if (fileTreeWidth) {
            layoutDockWidth = fileTreeWidth / (1 + embedDualDocListFlex);
        }
    }


    let newLayoutDockWidth = layoutDockWidth * (1 + embedDualDocListFlex);;
    updateFileTreeDockWidthAndConf(layoutDockElement, newLayoutDockWidth);
}

function destroyEmbedDualDocList() {

    if (embedDocListSvelte) {
        embedDocListSvelte.$destroy();
        embedDocListSvelte = null;
    }
    let docListPageElementArray = document.querySelectorAll(`div.layout-tab-container div[data-id][${EmbedDualDocListElementAttrName}]`);
    if (docListPageElementArray) {
        for (const pageElement of docListPageElementArray) {
            let layoutDockElement = hasClosestBySelector(pageElement, "div.layout__dockl", true);
            if (!layoutDockElement) {
                layoutDockElement = hasClosestBySelector(pageElement, "div.layout__dockr", true);
            }
            if (layoutDockElement) {
                let dualDocListidth = pageElement.getBoundingClientRect().width;
                let layoutDockWidth = layoutDockElement.getBoundingClientRect().width;
                let newLayoutDockWidth = layoutDockWidth - dualDocListidth;
                updateFileTreeDockWidthAndConf(layoutDockElement, newLayoutDockWidth)

            }

            pageElement.remove();
        }
    }
}


function getEmbedDualDocListElement(): HTMLElement {
    let docListElement = document.createElement("div");
    docListElement.setAttribute(EmbedDualDocListElementAttrName, "1");
    docListElement.classList.add("fn__flex-1");
    docListElement.style.display = "flex";

    docListElement.addEventListener("click", (event) => {
        event.stopPropagation();
    })



    let settingConfig = SettingService.ins.SettingConfig;
    let listViewFlex = "1";
    if (!isNaN(settingConfig.embedDocListViewFlex)) {
        listViewFlex = settingConfig.embedDocListViewFlex.toString();
    }
    docListElement.style.flex = listViewFlex;


    return docListElement;
}


function getDragElement(): HTMLElement {


    let dragHandleElement = document.createElement("div");
    dragHandleElement.classList.add("drag-handle");
    dragHandleElement.style.flexShrink = "0";

    let startX;
    let startWidth; // 初始宽度
    let startFlexGrow; // 初始 flex-grow
    let containerWidth;
    let fileTreeDocElement;
    let docListElement;
    let dockContainerElement;
    dragHandleElement.addEventListener('mousedown', (e) => {
        fileTreeDocElement = document.querySelector("#layouts  div.layout-tab-container div.file-tree.sy__file");

        docListElement = document.querySelector(`div.layout-tab-container div[${EmbedDualDocListElementAttrName}]`) as HTMLElement;
        if (!fileTreeDocElement || !docListElement) {
            return;
        }
        clearSyFileTreeItemFocusClass();
        startX = e.clientX;
        // 获取当前 flex-item 的初始宽度
        startWidth = docListElement.offsetWidth;
        // 获取当前 flex-item 的初始 flex-grow
        startFlexGrow = parseFloat(window.getComputedStyle(docListElement).flexGrow);
        dockContainerElement = document.querySelector("div.layout__dockl") as HTMLElement;
        if (!dockContainerElement.contains(fileTreeDocElement)) {
            dockContainerElement = document.querySelector("div.layout__dockr");
        }
        docListElement.parentElement.parentElement.parentElement.parentElement;
        // 获取容器的总宽度
        containerWidth = dockContainerElement.offsetWidth;


        // 禁用文本选择
        dockContainerElement.style.userSelect = 'none';

        dockContainerElement.addEventListener('mousemove', resize);
        dockContainerElement.addEventListener('mouseup', stopResize);
        // console.log(dockContainerElement)
    });

    function resize(e) {
        // 计算鼠标移动的距离
        let deltaX = e.clientX - startX;
        if (document.querySelector("div.layout__dockl").contains(fileTreeDocElement)) {
            deltaX = startX - e.clientX;
        }

        if (deltaX == 0) {
            return
        }

        // 计算新的宽度
        const newWidth = startWidth + deltaX;

        if (newWidth > containerWidth - 1) {
            return;
        }
        let anotherWidth = fileTreeDocElement.offsetWidth;

        let newFlexGrow = newWidth / anotherWidth
        if (deltaX > 0 && newFlexGrow < startFlexGrow) {
            //return
        }
        if (deltaX < 0 && newFlexGrow > startFlexGrow) {
            //return
        }

        // 更新 flex-grow 值，确保不小于 0.1，避免过小
        docListElement.style.flexGrow = Math.max(newFlexGrow, 0.1).toString();
    }

    function stopResize() {
        let dockContainerElement = docListElement.parentElement.parentElement.parentElement.parentElement;
        // 恢复文本选择
        dockContainerElement.style.userSelect = '';
        SettingService.ins.updateSettingCofnigValue("embedDocListViewFlex", docListElement.style.flexGrow);

        dockContainerElement.removeEventListener('mousemove', resize);
        dockContainerElement.removeEventListener('mouseup', stopResize);
    }

    return dragHandleElement;
}




function addDocListDock() {
    if (!EnvConfig.ins || !EnvConfig.ins.plugin) {
        console.log("添加文档列表 dock 失败。")
        return;
    }

    let docSearchDockPoisition = SettingService.ins.SettingConfig.dualDocListDockPosition;
    if (!docSearchDockPoisition || docSearchDockPoisition === "Hidden") {
        console.log("不添加文档列表 dock")
        return;
    }
    let position: any = docSearchDockPoisition;

    let plugin = EnvConfig.ins.plugin;
    try {

        let dockRet = plugin.addDock({
            config: {
                position: position,
                size: { width: 260, height: 0 },
                icon: CUSTOM_ICON_MAP.iconDualDocList.id,
                title: "二级文档列表",
                show: false,
                hotkey: "⌥T",
            },
            data: {},
            type: DOC_LIST_DOCK_TYPE,
            resize() {
                if (dockDocListSvelte) {
                    dockDocListSvelte.restView();
                }
            },
            update() {
                if (dockDocListSvelte) {
                    dockDocListSvelte.restView();
                }
            },
            init() {
                this.element.innerHTML = "";
                dockDocListSvelte = new DocListDockSvelte({
                    target: this.element,
                    props: {
                    }
                });
            },
            destroy() {
                if (dockDocListSvelte) {
                    dockDocListSvelte.$destroy();
                }
            }
        });
    } catch (e) {
        console.log("addDock e", e)
    }


    // plugin.addCommand({
    //     langKey: DOC_LIST_DOCK_TYPE + "_mapkey",
    //     langText: EnvConfig.ins.i18n.documentBasedSearchDock,
    //     hotkey: "⌥Q",
    //     callback: () => {
    //         console.log("addCommand callback");
    //         const ele = document.querySelector(
    //             `span[data-type="${plugin.name + DOC_LIST_DOCK_TYPE}"]`,
    //         ) as HTMLElement;
    //         if (ele) {
    //             ele.click();
    //         }
    //         if (docSearchSvelet) {
    //             docSearchSvelet.iconClick();
    //         }
    //     },
    // });

}



function destoryDocListDock() {
    if (!EnvConfig.ins || !EnvConfig.ins.plugin) {
        console.log("添加文档列表 dock 失败。")
        return;
    }
    EnvConfig.ins.plugin.name;
    let pluginID = EnvConfig.ins.plugin.name + DOC_LIST_DOCK_TYPE;
    console.log(pluginID)
    console.log("syplugin-dual-doc-listmisuzu2027_doc_list_dock");
    // sy__syplugin-dual-doc-listmisuzu2027_doc_list_dock

    let dockContainerElement = document.querySelector(`span.sy__${pluginID}`);
    let dockBtnElement = document.querySelector(`div[data-type="${pluginID}"]`);

    if (dockDocListSvelte) {
        dockDocListSvelte.$destroy();
    }
    if (dockBtnElement) {
        dockBtnElement.remove();
    }
    if (dockContainerElement) {
        dockContainerElement.remove();
    }
}


// let observerCommonMenuElement: MutationObserver;

// function addObserveCommonMenuElement() {
//     if (EnvConfig.ins.isMobile) {
//         return;
//     }
//     let protyleUtilElement = document.querySelector("#commonMenu > div.b3-menu__items");
//     if (protyleUtilElement.getAttribute("data-misuzu2027-observed") == "1") {
//         return;
//     }
//     if (observerCommonMenuElement) {
//         observerCommonMenuElement.disconnect;
//     }

//     // 创建一个 MutationObserver 实例，并传入回调函数
//     observerCommonMenuElement = new MutationObserver((mutationsList, observer) => {

//         let childNodes = protyleUtilElement.childNodes;
//         if (childNodes.length == 3
//             && childNodes[0].childNodes[1].textContent == "新建笔记本") {
//             createSwitchEmbedDualDocListButtonEle();
//         }

//         return;
//     });

//     // 配置 MutationObserver 监听的类型
//     const config = { childList: true, };
//     protyleUtilElement.setAttribute("data-misuzu2027-observed", "1")
//     // 开始观察目标节点
//     observerCommonMenuElement.observe(protyleUtilElement, config);
// }

// function destroyObserveCommonMenuElement() {
//     observerCommonMenuElement.disconnect();
// }


// function createSwitchEmbedDualDocListButtonEle() {
//     let menuElement = document.querySelector("#commonMenu > div.b3-menu__items");
//     if (!menuElement) {
//         return;
//     }
//     let showEmbedDualDocList = SettingService.ins.SettingConfig.showEmbedDualDocList;

//     let switchDocListButtonEle = document.createElement("button");
//     switchDocListButtonEle.classList.add("b3-menu__item");
//     let svgElement = document.createElement("svg");
//     svgElement.classList.add("b3-menu__icon");
//     let spanElement = document.createElement("span");
//     spanElement.classList.add("b3-menu__label");
//     spanElement.textContent = "二级文档列表";
//     if (showEmbedDualDocList) {
//         svgElement.innerHTML = (`<use xlink:href="#iconSelect"></use>`);
//     }

//     switchDocListButtonEle.append(svgElement, spanElement);
//     switchDocListButtonEle.addEventListener("click", (event) => {
//         event.stopPropagation();
//         event.preventDefault();
//         SettingService.ins.updateSettingCofnigValue("showEmbedDualDocList", !showEmbedDualDocList)
//         DocListManager.ins.intervalCheckEmbedDualDocList();
//         window.siyuan.menus.menu.remove();
//     })

//     menuElement.append(switchDocListButtonEle);

// }


type AnyObject = { [key: string]: any };

function findFileTreeWidth(obj: AnyObject): number | undefined {
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const result = findFileTreeWidth(item);
            if (result !== undefined) return result;
        }
    } else if (typeof obj === "object" && obj !== null) {
        if (obj.type === "file" && obj.size?.width !== undefined) {
            return obj.size.width;
        }

        for (const key in obj) {
            const result = findFileTreeWidth(obj[key]);
            if (result !== undefined) return result;
        }
    }
    return undefined;
}



function updateFileTreeWidth(obj: AnyObject, width: number) {
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const result = updateFileTreeWidth(item, width);
            if (result !== undefined) return result;
        }
    } else if (typeof obj === "object" && obj !== null) {
        if (obj.type === "file" && obj.size?.width !== undefined) {
            obj.size.width = width;
            return;
        }

        for (const key in obj) {
            const result = updateFileTreeWidth(obj[key], width);
            if (result !== undefined) return result;
        }
    }

    return;
}

function updateFileTreeDockWidthAndConf(layoutDockElement: HTMLElement, newLayoutDockWidth: number) {
    layoutDockElement.style.width = newLayoutDockWidth + "px";
    updateFileTreeWidth(window.siyuan.config.uiLayout, newLayoutDockWidth);
    // console.log("updateFileTreeWidth ", window.siyuan.config.uiLayout)
    setUILayout(false, window.siyuan.config.uiLayout);

}


// function updateFileTreeDockWidth(layoutDockElement: HTMLElement, newLayoutDockWidth: number) {
//     layoutDockElement.style.width = newLayoutDockWidth + "px";
//     updateFileTreeWidth(window.siyuan.config.uiLayout, newLayoutDockWidth);
//     // -----------
//     let fileTreeSpanElement = window.siyuan.layout.leftDock.element.querySelector(`span[data-index][data-type="file"]`);
//     if (!fileTreeSpanElement) {
//         fileTreeSpanElement = window.siyuan.layout.rightDock.element.querySelector(`span[data-index][data-type="file"]`);
//     }
//     if (fileTreeSpanElement) {
//         fileTreeSpanElement.setAttribute("data-width", newLayoutDockWidth);
//         console.log("updateFileTreeWidth fileTreeSpanElement", fileTreeSpanElement.getAttribute("data-width"))
//     }
//     // -----------
//     console.log(" updateFileTreeDockWidth ", window.siyuan.config.uiLayout)
//     triggerMouseDownMoveUp(layoutDockElement.querySelector(".layout__resize"))
// }

// function triggerMouseDownMoveUp(element: HTMLElement) {
//     if (!element) {
//         console.warn("Invalid element passed to triggerMouseDownMoveUp");
//         return;
//     }

//     const rect = element.getBoundingClientRect();
//     const centerX = rect.left + rect.width / 2;
//     const centerY = rect.top + rect.height / 2;

//     const mouseDownEvent = new MouseEvent("mousedown", {
//         bubbles: true,
//         cancelable: true,
//         view: window,
//         clientX: centerX,
//         clientY: centerY,
//     });

//     const mouseMoveEvent1 = new MouseEvent("mousemove", {
//       bubbles: true,
//       cancelable: true,
//       view: window,
//       clientX: centerX,
//       clientY: centerY,
//     });

//     const mouseUpEvent = new MouseEvent("mouseup", {
//         bubbles: true,
//         cancelable: true,
//         view: window,
//         clientX: centerX,
//         clientY: centerY,
//     });

//     element.dispatchEvent(mouseDownEvent);
//     element.dispatchEvent(mouseMoveEvent1);
//     // element.dispatchEvent(mouseMoveEvent2);
//     element.dispatchEvent(mouseUpEvent);
// }