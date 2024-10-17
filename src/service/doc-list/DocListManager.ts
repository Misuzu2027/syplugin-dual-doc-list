import DocListSvelte from "@/components/doc-list/doc-list.svelte";
import DocListDockSvelte from "@/components/siyuan/dock/doc-list-dock.svelte";
import { EnvConfig } from "@/config/EnvConfig";
import { CUSTOM_ICON_MAP } from "@/models/icon-constant";
import { SettingConfig } from "@/models/setting-model";
import { SettingService } from "@/service/setting/SettingService";
import { findParentElementWithAttribute, getAttributeRecursively } from "@/utils/html-util";
import Instance from "@/utils/Instance";
import { clearSyFileTreeItemFocusClass, isElementHidden } from "@/utils/siyuan-util";

const EmbedDualDocListElementAttrName = "data-misuzu2027-embed-dualDocList";


const DOC_LIST_DOCK_TYPE = "misuzu2027_doc_list_dock";

export class DocListManager {


    public static get ins(): DocListManager {
        return Instance.get(DocListManager);
    }


    private checkEmbedIntervalId;

    private embedDocListSvelte: DocListSvelte;

    public dockDocListSvelte: DocListDockSvelte;

    init() {
        this.initElementEventListener();
        this.initInterval();
        addDocListDock();
        addObserveCommonMenuElement();
    }


    destroy() {
        this.destroyInterval();
        this.destroyElementEventListener();
        this.destroyEmbedDualDocList();
        destroyObserveCommonMenuElement();
    }



    initElementEventListener() {
        document.addEventListener('click', this.documentGlobeClickEvent, true);
    }

    destroyElementEventListener() {
        document.removeEventListener('click', this.documentGlobeClickEvent, true);
    }

    initInterval() {
        this.destroyInterval();
        this.checkEmbedIntervalId = setInterval(() => this.intervalCheckEmbedDualDocList(), 800)
    }

    destroyInterval() {
        if (this.checkEmbedIntervalId) {
            clearInterval(this.checkEmbedIntervalId);
            this.checkEmbedIntervalId = null;
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

    intervalCheckEmbedDualDocList() {
        let showEmbedDualDocList = SettingService.ins.SettingConfig.showEmbedDualDocList;
        if (showEmbedDualDocList) {
            this.createEmbedDualDocList();
        } else {
            this.destroyEmbedDualDocList();
        }
    }

    createEmbedDualDocList() {
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

        if (this.embedDocListSvelte) {
            this.embedDocListSvelte.$destroy();
            this.embedDocListSvelte = null;
        }

        let docListElement = getEmbedDualDocListElement();
        docListElement.setAttribute("data-id", docTreeId);
        if (isElementHidden(fileTreeDocElement)) {
            docListElement.classList.add("fn__none");
        }

        this.embedDocListSvelte = new DocListSvelte({
            target: docListElement,
            props: {
            }
        });

        let dragHandleElement = getDragElement();

        if (document.querySelector("div.layout__dockl").contains(fileTreeDocElement)) {
            docListElement.insertBefore(dragHandleElement, docListElement.firstChild)
            fileTreeDocElement.after(docListElement);
        } else {
            docListElement.append(dragHandleElement);
            fileTreeDocElement.before(docListElement);
        }

    }

    destroyEmbedDualDocList() {
        if (this.embedDocListSvelte) {
            this.embedDocListSvelte.$destroy();
            this.embedDocListSvelte = null;
        }
        let docListPageElementArray = document.querySelectorAll(`div.layout-tab-container div[data-id][${EmbedDualDocListElementAttrName}]`);
        if (docListPageElementArray) {
            for (const pageElement of docListPageElementArray) {
                pageElement.remove();
            }
        }
    }

    clickCount: number = 0;

    documentGlobeClickEvent = (event: MouseEvent) => {
        if (event.button != 0 || event.ctrlKey) {
            return;
        }

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

        this.handleSelectDoc(targetLiElement)
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

    handleSelectDoc(targetLiElement: HTMLElement) {
        if (!targetLiElement) {
            return;
        }
        let notebookId: string;
        let docId: string;
        let docPath: string;
        // let type = targetLiElement.getAttribute("data-type");
        notebookId = getAttributeRecursively(targetLiElement, "data-url");
        docId = targetLiElement.getAttribute("data-node-id");
        docPath = targetLiElement.getAttribute("data-path");

        if ((!docId && !notebookId)) {
            return;
        }

        if (this.embedDocListSvelte) {
            this.embedDocListSvelte.switchPath(notebookId, docId, docPath);
        }
        if (this.dockDocListSvelte) {
            this.dockDocListSvelte.switchPath(notebookId, docId, docPath)
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
        console.log(dockContainerElement)
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
            if (DocListManager.ins.dockDocListSvelte) {
                DocListManager.ins.dockDocListSvelte.restView();
            }
        },
        update() {
            if (DocListManager.ins.dockDocListSvelte) {
                DocListManager.ins.dockDocListSvelte.restView();
            }
        },
        init() {
            this.element.innerHTML = "";
            DocListManager.ins.dockDocListSvelte = new DocListDockSvelte({
                target: this.element,
                props: {
                }
            });
        },
        destroy() {
            if (DocListManager.ins.dockDocListSvelte) {
                DocListManager.ins.dockDocListSvelte.$destroy();
            }
        }
    });


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

    if (DocListManager.ins.dockDocListSvelte) {
        DocListManager.ins.dockDocListSvelte.$destroy();
    }
    if (dockBtnElement) {
        dockBtnElement.remove();
    }
    if (dockContainerElement) {
        dockContainerElement.remove();
    }
}


let observerCommonMenuElement: MutationObserver;

function addObserveCommonMenuElement() {
    let protyleUtilElement = document.querySelector("#commonMenu > div.b3-menu__items");
    if (protyleUtilElement.getAttribute("data-misuzu2027-observed") == "1") {
        return;
    }
    if (observerCommonMenuElement) {
        observerCommonMenuElement.disconnect;
    }

    // 创建一个 MutationObserver 实例，并传入回调函数
    observerCommonMenuElement = new MutationObserver((mutationsList, observer) => {

        let childNodes = protyleUtilElement.childNodes;
        if (childNodes.length == 3
            && childNodes[0].childNodes[1].textContent == "新建笔记本") {
            createSwitchEmbedDualDocListButtonEle();
        }

        return;
    });

    // 配置 MutationObserver 监听的类型
    const config = { childList: true, };
    protyleUtilElement.setAttribute("data-misuzu2027-observed", "1")
    // 开始观察目标节点
    observerCommonMenuElement.observe(protyleUtilElement, config);
}

function destroyObserveCommonMenuElement() {
    observerCommonMenuElement.disconnect();
}


function createSwitchEmbedDualDocListButtonEle() {
    let menuElement = document.querySelector("#commonMenu > div.b3-menu__items");
    if (!menuElement) {
        return;
    }
    let showEmbedDualDocList = SettingService.ins.SettingConfig.showEmbedDualDocList;

    let switchDocListButtonEle = document.createElement("button");
    switchDocListButtonEle.classList.add("b3-menu__item");
    let svgElement = document.createElement("svg");
    svgElement.classList.add("b3-menu__icon");
    let spanElement = document.createElement("span");
    spanElement.classList.add("b3-menu__label");
    spanElement.textContent = "二级文档列表";
    if (showEmbedDualDocList) {
        svgElement.innerHTML = (`<use xlink:href="#iconSelect"></use>`);
    }

    switchDocListButtonEle.append(svgElement, spanElement);
    switchDocListButtonEle.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        SettingService.ins.updateSettingCofnigValue("showEmbedDualDocList", !showEmbedDualDocList)
        DocListManager.ins.intervalCheckEmbedDualDocList();
        window.siyuan.menus.menu.remove();
    })

    menuElement.append(switchDocListButtonEle);

}


