import { DocListManager } from "@/service/doc-list/DocListManager";
import { ItemProperty, IOption, TabProperty } from "./setting-model";
import { EnvConfig } from "@/config/EnvConfig";

export const DUAL_DOC_LIST_SORT_ATTR_KEY = "custom-dual-doc-list-sort"

export function getSettingTabArray(): TabProperty[] {

    let tabProperties: TabProperty[] = [

    ];

    tabProperties.push(
        new TabProperty({
            key: "function-setting", name: "功能", iconKey: "iconFilter", props: [
                new ItemProperty({ key: "showEmbedDualDocList", type: "switch", name: "显示嵌入的二级文档列表", description: "", tips: "", afterUpdateCallback: showEmbedDualDocListAfterUpdate }),

                new ItemProperty({ key: "doubleClickToggleNotebook", type: "switch", name: "双击展开/折叠笔记本", description: "", tips: "" }),
                new ItemProperty({ key: "doubleClickDocumentToTreeLocator", type: "switch", name: "双击文档在文档树中定位", description: "关闭后双击会进入子目录", tips: "", }),

                new ItemProperty({ key: "dualDocListDockPosition", type: "select", name: "二级文档列表Dock", description: "修改后会刷新界面", tips: "", options: getDockPositionElement(), afterUpdateCallback: dualDocListDockPositionAfterUpdate }),

                new ItemProperty({ key: "defaultPathId", type: "text", name: "默认显示路径（为空则显示全部文档）", description: "填写笔记本ID或文档ID，如果ID不存在，则显示全部文档", tips: "", }),

                new ItemProperty({ key: "mobileShowDualDocListTab", type: "switch", name: "移动端默认打开二级文档列表页", description: "", tips: "", }),

            ]

        }),
        new TabProperty({
            key: "query-setting", name: "查询相关", iconKey: "iconLink", props: [
                // new ItemProperty({ key: "lockSortMode", type: "switch", name: "锁定排序方式", description: "", tips: "", min: 0 }),
                new ItemProperty({ key: "showSubDocOfSubDoc", type: "switch", name: "默认显示子文档的子文档", description: "", tips: "" }),
                new ItemProperty({ key: "fullTextSearch", type: "switch", name: "默认全文搜索", description: "", tips: "" }),
                new ItemProperty({ key: "defaultDbQuerySortOrder", type: "select", name: "数据库默认查询方式", description: "何时会用到这个配置？<br/>当使用数据库查询文档，且笔记本排序方式为“文档大小”、“子文档数”、“自定义” 排序时，会重置为此方式。", tips: "", options: getDocDbQuerySortMethodElement() }),
                new ItemProperty({ key: "allDocsQueryLimit", type: "number", name: "显示所有文档最大数量", description: "", tips: "", min: 0 }),
                new ItemProperty({ key: "docDirectorySortSave", type: "switch", name: "保存文档目录排序方式", description: "开启：在文档目录中切换排序方式时，会自动保存当前目录的排序偏好，下次访问该目录时能够保持相同的排序方式。<br/>关闭（默认）：使用笔记本或文档树的排序方式。", tips: "", min: 0 }),

            ]

        }),
        new TabProperty({
            key: "style-setting", name: "样式", iconKey: "iconPlugin", props: [
                new ItemProperty({ key: "embedDocListViewFlex", type: "number", name: "二级文档列表与文档树比例", description: "数字越大二级文档列表越宽。", tips: "", min: 0, }),
                new ItemProperty({ key: "showFileTreeTopSwitchEmbedDualDocListButton", type: "switch", name: "文档树顶部显示切换嵌入二级文档列表按钮", description: "", tips: "", min: 0, }),
            ]
        }),
        new TabProperty({
            key: "other-setting", name: "其他", iconKey: "iconPlugin", props: [
                new ItemProperty({ key: "doubleClickTimeout", type: "number", name: "双击时间阈值(毫秒)", description: "", tips: "", min: 0, }),
            ]
        }),
    );

    return tabProperties;
}

function showEmbedDualDocListAfterUpdate(key, value) {
    
}


function dualDocListDockPositionAfterUpdate(key, value) {
    DocListManager.ins.refreshDocListDock(value);
}



function getDockPositionElement(): IOption[] {

    let options: IOption[] = [];
    options.push({
        name: "隐藏",
        value: "Hidden",
    });
    options.push({
        name: "显示",
        value: "RightTop",
    });


    return options;
}



function getDocDbQuerySortMethodElement(): IOption[] {
    let docDbQuerySortMethodElements = SETTING_DOCUMENT_LIST_DB_SORT_METHOD_ELEMENT();
    let options: IOption[] = [];
    for (const element of docDbQuerySortMethodElements) {
        options.push(element);
    }

    return options;
}


export function SETTING_DOCUMENT_LIST_SORT_METHOD_ELEMENT(): { text: string, value: DocumentSortMode }[] {
    return [
        {
            text: EnvConfig.ins.i18n.modifiedASC,
            value: "UpdatedASC",
        },
        {
            text: EnvConfig.ins.i18n.modifiedDESC,
            value: "UpdatedDESC",
        },
        {
            text: EnvConfig.ins.i18n.createdASC,
            value: "CreatedASC",
        },
        {
            text: EnvConfig.ins.i18n.createdDESC,
            value: "CreatedDESC",
        },
        {
            text: EnvConfig.ins.i18n.fileNameASC,
            value: "NameASC",
        },
        {
            text: EnvConfig.ins.i18n.fileNameDESC,
            value: "NameDESC",
        },
        {
            text: EnvConfig.ins.i18n.fileNameNatASC,
            value: "AlphanumASC",
        },
        {
            text: EnvConfig.ins.i18n.fileNameNatDESC,
            value: "AlphanumDESC",
        },
        {
            text: EnvConfig.ins.i18n.refCountASC,
            value: "RefCountASC",
        },
        {
            text: EnvConfig.ins.i18n.refCountDESC,
            value: "RefCountDESC",
        },
        {
            text: EnvConfig.ins.i18n.docSizeASC,
            value: "SizeASC",
        },
        {
            text: EnvConfig.ins.i18n.docSizeDESC,
            value: "SizeDESC",
        },
        {
            text: EnvConfig.ins.i18n.subDocCountASC,
            value: "SubDocCountASC",
        },
        {
            text: EnvConfig.ins.i18n.subDocCountDESC,
            value: "SubDocCountDESC",
        },
        {
            text: EnvConfig.ins.i18n.customSort,
            value: "Custom",
        },
        // {
        //     text: EnvConfig.ins.i18n.sortByFiletree,
        //     value: "FileTree",
        // },
    ];
}

export function SETTING_DOCUMENT_LIST_DB_SORT_METHOD_ELEMENT(): { name: string, value: DocumentSortMode }[] {
    return [
        {
            name: EnvConfig.ins.i18n.modifiedASC,
            value: "UpdatedASC",
        },
        {
            name: EnvConfig.ins.i18n.modifiedDESC,
            value: "UpdatedDESC",
        },
        {
            name: EnvConfig.ins.i18n.createdASC,
            value: "CreatedASC",
        },
        {
            name: EnvConfig.ins.i18n.createdDESC,
            value: "CreatedDESC",
        },
        {
            name: EnvConfig.ins.i18n.fileNameASC,
            value: "NameASC",
        },
        {
            name: EnvConfig.ins.i18n.fileNameDESC,
            value: "NameDESC",
        },
        {
            name: EnvConfig.ins.i18n.fileNameNatASC,
            value: "AlphanumASC",
        },
        {
            name: EnvConfig.ins.i18n.fileNameNatDESC,
            value: "AlphanumDESC",
        },
        {
            name: EnvConfig.ins.i18n.refCountASC,
            value: "RefCountASC",
        },
        {
            name: EnvConfig.ins.i18n.refCountDESC,
            value: "RefCountDESC",
        },

    ];
}