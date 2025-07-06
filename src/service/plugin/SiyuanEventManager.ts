import { EnvConfig } from "@/config/EnvConfig";
import Instance from "@/utils/Instance";
import { MobileTabService } from "./MobileTabService";


export class SiyuanEventManager {
    public static get ins(): SiyuanEventManager {
        return Instance.get(SiyuanEventManager);
    }

    /**
     * 初始化事件注册
     */
    init() {
        EnvConfig.ins.plugin.eventBus.on("switch-protyle", this.handleSwitchProtyle);
    }

    /**
     * 销毁事件
     */
    destroy() {
        EnvConfig.ins.plugin.eventBus.off("switch-protyle", this.handleSwitchProtyle);
    }

    /**
     * 处理 switch-protyle 事件
     */
    private handleSwitchProtyle = (...args: any[]) => {
        
        MobileTabService.ins.close();
    };
}
