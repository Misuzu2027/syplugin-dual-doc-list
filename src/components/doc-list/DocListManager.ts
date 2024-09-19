import DocList from "@/components/doc-list/doc-list.svelte";
import { SettingService } from "@/service/setting/SettingService";
import { findParentElementWithAttribute, getAttributeRecursively } from "@/utils/html-util";
import Instance from "@/utils/Instance";

const EmbedDualDocListElementAttrName = "data-misuzu2027-embed-dualDocList";
export class DocListManager {


    public static get ins(): DocListManager {
        return Instance.get(DocListManager);
    }


    private checkEmbedIntervalId;

    private embedDocListSvelte: DocList;

    init() {
        this.initInterval();
        this.initElementEventListener();
    }


    destroy() {
        this.destroyInterval();
        this.destroyElementEventListener();
        this.destroyEmbedDualDocList();
    }

    initElementEventListener() {
        document.addEventListener('click', this.documentGlobeClickEvent, true);
    }

    destroyElementEventListener() {
        document.removeEventListener('click', this.documentGlobeClickEvent, true);
    }

    initInterval() {
        this.destroyInterval();
        this.checkEmbedIntervalId = setInterval(() => this.intervalCheckEmbedDualDocTree(), 800)
    }

    destroyInterval() {
        if (this.checkEmbedIntervalId) {
            clearInterval(this.checkEmbedIntervalId);
            this.checkEmbedIntervalId = null;
        }
    }

    intervalCheckEmbedDualDocTree() {
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

        let settingConfig = SettingService.ins.SettingConfig;
        let listViewFlex = "1";
        if (!isNaN(settingConfig.embedDocListViewFlex)) {
            listViewFlex = settingConfig.embedDocListViewFlex.toString();
        }

        if (dualDocListElement) {
            if (dualDocListElement.style.flex != listViewFlex) {
                dualDocListElement.style.flex = listViewFlex;
            }
            return;
        }

        if (this.embedDocListSvelte) {
            this.embedDocListSvelte.$destroy();
            this.embedDocListSvelte = null;
        }
        let docListElement = document.createElement("div");
        docListElement.setAttribute("data-id", docTreeId);
        docListElement.setAttribute(EmbedDualDocListElementAttrName, "1");
        docListElement.classList.add("fn__flex-1");

        docListElement.style.flex = listViewFlex;

        docListElement.addEventListener("click", (event) => {
            event.stopPropagation();
        })

        if (document.querySelector("div.layout__dockl").contains(fileTreeDocElement)) {
            fileTreeDocElement.after(docListElement);
        } else {
            fileTreeDocElement.before(docListElement);
        }


        this.embedDocListSvelte = new DocList({
            target: docListElement,
            props: {
            }
        });
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
            this.handleNotebookDoubleClick(event);
        }

        this.handleSelectDoc(targetLiElement)
    }

    private handleNotebookDoubleClick(event: MouseEvent): void {
        let settingConfig = SettingService.ins.SettingConfig;
        if (!settingConfig || !settingConfig.doubleClickToggleNotebook) {
            return;
        }
        this.clickCount++;
        let doubleClickTimeout = settingConfig.doubleClickTimeout;
        if (this.clickCount < 2) {
            event.stopPropagation();
            event.preventDefault();
            setTimeout(() => {
                this.clickCount = 0;
            }, doubleClickTimeout);
        }
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

        if ((!docId && !notebookId) || !this.embedDocListSvelte) {
            return;
        }

        this.embedDocListSvelte.switchPath(notebookId, docId, docPath);
    }



}
