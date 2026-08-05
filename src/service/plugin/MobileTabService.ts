import { EnvConfig } from "@/config/EnvConfig";
import DocListSvelte from "@/components/doc-list/doc-list.svelte";
import Instance from "@/utils/Instance";
import { SettingService } from "../setting/SettingService";
import { CUSTOM_ICON_MAP } from "@/models/icon-constant";

export class MobileTabService {
    private mobileTabDocListEle: HTMLElement | null = null;
    private mobileTabDocListSvelte: DocListSvelte | null = null;
    private topBarAdded = false;

    public static get ins(): MobileTabService {
        return Instance.get(MobileTabService);
    }

    public async init() {
        if (!EnvConfig.ins.isMobile) {
            return;
        }

        if (!this.topBarAdded) {
            EnvConfig.ins.plugin.addTopBar({
                icon: CUSTOM_ICON_MAP.iconDualDocList.id,
                title: "二级文档列表页",
                position: "left",
                callback: () => {
                    this.open();
                }
            });
            this.topBarAdded = true;
        }

        let settingConfig = SettingService.ins.SettingConfig;
        if (settingConfig.mobileShowDualDocListTab) {
            this.createMobileTab();
        }
    }

    public async destory() {
        if (this.mobileTabDocListSvelte) {
            this.mobileTabDocListSvelte.$destroy();
            this.mobileTabDocListSvelte = null;
        }
        if (this.mobileTabDocListEle) {
            this.mobileTabDocListEle.remove();
            this.mobileTabDocListEle = null;
        }
        this.topBarAdded = false;
    }

    public exist(): boolean {
        if (this.mobileTabDocListSvelte) {
            return true;
        }
        return false;
    }

    public switchPath(notebookId: string, docId: string, docPath: string) {
        if (!this.mobileTabDocListSvelte) {
            return;
        }
        let hidden = this.mobileTabDocListEle.classList.contains("fn__none");
        if (hidden) {
            return;
        }
        if (this.mobileTabDocListSvelte) {
            this.mobileTabDocListSvelte.switchPath(notebookId, docId, docPath);

        }
    }

    private createMobileTab() {
        if (this.mobileTabDocListSvelte) {
            this.mobileTabDocListSvelte.$destroy();
            this.mobileTabDocListSvelte = null;
        }
        if (this.mobileTabDocListEle) {
            this.mobileTabDocListEle.remove();
            this.mobileTabDocListEle = null;
        }
        this.mobileTabDocListEle = document.createElement("div");
        this.mobileTabDocListEle.classList.add("fn__flex-column", "misuzu2027__doc-list");
        this.mobileTabDocListEle.style.height = "100%";
        this.mobileTabDocListSvelte = new DocListSvelte({
            target: this.mobileTabDocListEle,
            props: {
            }
        });

        let toolbarEle = document.querySelector("body>div.toolbar.toolbar--border");
        toolbarEle.before(this.mobileTabDocListEle);
    }

    public open() {
        if (!EnvConfig.ins.isMobile) {
            return;
        }
        if (!this.mobileTabDocListEle) {
            this.createMobileTab();
        }
        let sidebarEle = document.querySelector("#sidebar") as HTMLElement;
        sidebarEle.style.removeProperty("transform");
        let menuEle = document.querySelector("#menu") as HTMLElement;
        menuEle.style.removeProperty("transform");
        let sideMaskEle = document.querySelector("body>div.side-mask") as HTMLElement;
        sideMaskEle.classList.add("fn__none");

        this.mobileTabDocListEle.classList.remove("fn__none");
        this.mobileTabDocListEle.style.zIndex = (++window.siyuan.zIndex).toString();
    }

    public close() {
        if (!EnvConfig.ins.isMobile || !this.mobileTabDocListEle) {
            return;
        }
        this.mobileTabDocListEle.classList.add("fn__none");
    }
}
