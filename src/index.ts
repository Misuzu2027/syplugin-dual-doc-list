import {
    Plugin,
} from "siyuan";
import "@/index.scss";
import { DocListManager } from "./service/doc-list/DocListManager";
import { EnvConfig } from "./config/EnvConfig";
import { CUSTOM_ICON_MAP } from "./models/icon-constant";
import { openSettingsDialog } from "./components/setting/SettingManager";
import { SettingService } from "./service/setting/SettingService";



export default class PluginSample extends Plugin {

    async onload() {
        EnvConfig.ins.init(this);
        await SettingService.ins.init();
        DocListManager.ins.init();

        // 图标的制作参见帮助文档
        for (const key in CUSTOM_ICON_MAP) {
            if (Object.prototype.hasOwnProperty.call(CUSTOM_ICON_MAP, key)) {
                const item = CUSTOM_ICON_MAP[key];
                this.addIcons(item.source);
            }
        }
    }

    onLayoutReady() {

    }

    async onunload() {
        DocListManager.ins.destroy();
    }

    uninstall() {
        DocListManager.ins.destroy();
    }

    openSetting(): void {
        openSettingsDialog();
    }





}


