import { EnvConfig } from "@/config/EnvConfig";
import { Dialog } from "siyuan";
import SettingPageSvelte from "@/components/setting/setting-page.svelte";

export function openSettingsDialog() {
    const isMobile = EnvConfig.ins.isMobile;
    const dialogId = "dual-doc-list-setting-" + Date.now();
    const title = EnvConfig.ins.i18n?.settingHub || "二级文档列表插件设置";

    let panel: SettingPageSvelte | null = null;
    const settingDialog = new Dialog({
        title,
        content: `
          <div id="${dialogId}" style="overflow: hidden; position: relative;height: 100%;"></div>
          `,
        width: isMobile ? "92vw" : "720px",
        height: "70vh",
        destroyCallback: () => {
            panel?.$destroy();
            panel = null;
        },
    });

    panel = new SettingPageSvelte({
        target: settingDialog.element.querySelector(`#${dialogId}`),
    });
}
