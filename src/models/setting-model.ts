import { isStrNotBlank } from "@/utils/string-util";


export class SettingConfig {
    // 显示嵌入的二级文档列表
    showEmbedDualDocList: boolean;
    // 改为双击切换笔记本的折叠展开
    doubleClickToggleNotebook: boolean;
    // 显示二级文档列表 Docker
    dualDocListDockPosition: DockPosition;

    // 切换路径时使用笔记本排序方式。
    // lockSortMode: boolean;
    // 显示子文档的子文档
    showSubDocOfSubDoc: boolean;
    // 全文搜索
    fullTextSearch: boolean;
    // 使用数据库查询时的默认查询方式
    defaultDbQuerySortOrder: DocumentSortMode;
    // 显示所有文档时的数量限制
    allDocsQueryLimit: number;

    // 记忆文档的排序方式。

    // 清空所有文档记忆的排序方式。



    // 样式相关
    embedDocListViewFlex: number;

    // 双击阈值
    doubleClickTimeout: number;


    // 数据库查询相关，暂不支持设置
    includeConcatFields: string[];
    fullTextSearchBlockType: BlockType[];

}


interface ITabProperty {
    key: string;
    name: string;
    props: Array<ItemProperty>;
    iconKey?: string;
}


export class TabProperty {
    key: string;
    name: string;
    iconKey: string;
    props: ItemProperty[];

    constructor({ key, name, iconKey, props }: ITabProperty) {
        this.key = key;
        this.name = name;
        if (isStrNotBlank(iconKey)) {
            this.iconKey = iconKey;
        } else {
            this.iconKey = "setting";
        }
        this.props = props;

    }

}

export interface IOption {
    name: string;
    desc?: string;
    value: string;
}




export class ItemProperty {
    key: string;
    type: IItemPropertyType;
    name: string;
    description: string;
    tips?: string;

    min?: number;
    max?: number;
    btndo?: () => void;
    options?: IOption[];
    afterUpdateCallback?: (key, value) => void;


    constructor({ key, type, name, description, tips, min, max, btndo, options, afterUpdateCallback }: ItemProperty) {
        this.key = key;
        this.type = type;
        this.min = min;
        this.max = max;
        this.btndo = btndo;
        this.options = options ?? [];
        this.name = name;
        this.description = description;
        this.tips = tips;
        this.afterUpdateCallback = afterUpdateCallback;
    }

}
