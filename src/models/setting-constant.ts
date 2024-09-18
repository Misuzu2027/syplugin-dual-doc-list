import { ItemProperty, IOption, TabProperty } from "./setting-model";

export function getSettingTabArray(): TabProperty[] {

    let tabProperties: TabProperty[] = [

    ];

    tabProperties.push(
        new TabProperty({
            key: "function-setting", name: "功能", iconKey: "iconFilter", props: [
                new ItemProperty({ key: "showEmbedDualDocList", type: "switch", name: "显示嵌入的二级文档列表", description: "", tips: "" }),

                new ItemProperty({ key: "doubleClickToggleNotebook", type: "switch", name: "双击展开/折叠笔记本", description: "", tips: "" }),

            ]

        }),
        new TabProperty({
            key: "query-setting", name: "查询相关", iconKey: "iconLink", props: [
                // new ItemProperty({ key: "lockSortMode", type: "switch", name: "锁定排序方式", description: "", tips: "", min: 0 }),
                new ItemProperty({ key: "showSubDocOfSubDoc", type: "switch", name: "默认显示子文档的子文档", description: "", tips: "" }),
                new ItemProperty({ key: "fullTextSearch", type: "switch", name: "全文搜索", description: "", tips: "" }),
                new ItemProperty({ key: "defaultDbQuerySortOrder", type: "select", name: "数据库默认查询方式", description: "何时会用到这个配置？<br/>当使用数据库查询文档，且笔记本排序方式为“文档大小”、“子文档数”、“自定义” 排序时，会重置为此方式。", tips: "", options: getDocDbQuerySortMethodElement() }),
                new ItemProperty({ key: "allDocsQueryLimit", type: "number", name: "显示所有文档最大数量", description: "", tips: "", min: 0 }),

            ]

        }),
        new TabProperty({
            key: "style-setting", name: "样式", iconKey: "iconPlugin", props: [
                new ItemProperty({ key: "embedDocListViewFlex", type: "number", name: "二级文档列表与文档树比例", description: "数字越大二级文档列表越宽。", tips: "", min: 0, }),
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
            text: window.siyuan.languages.modifiedASC,
            value: "UpdatedASC",
        },
        {
            text: window.siyuan.languages.modifiedDESC,
            value: "UpdatedDESC",
        },
        {
            text: window.siyuan.languages.createdASC,
            value: "CreatedASC",
        },
        {
            text: window.siyuan.languages.createdDESC,
            value: "CreatedDESC",
        },
        {
            text: window.siyuan.languages.fileNameASC,
            value: "NameASC",
        },
        {
            text: window.siyuan.languages.fileNameDESC,
            value: "NameDESC",
        },
        {
            text: window.siyuan.languages.fileNameNatASC,
            value: "AlphanumASC",
        },
        {
            text: window.siyuan.languages.fileNameNatDESC,
            value: "AlphanumDESC",
        },
        {
            text: window.siyuan.languages.refCountASC,
            value: "RefCountASC",
        },
        {
            text: window.siyuan.languages.refCountDESC,
            value: "RefCountDESC",
        },
        {
            text: window.siyuan.languages.docSizeASC,
            value: "SizeASC",
        },
        {
            text: window.siyuan.languages.docSizeDESC,
            value: "SizeDESC",
        },
        {
            text: window.siyuan.languages.subDocCountASC,
            value: "SubDocCountASC",
        },
        {
            text: window.siyuan.languages.subDocCountDESC,
            value: "SubDocCountDESC",
        },
        {
            text: window.siyuan.languages.customSort,
            value: "Custom",
        },
        // {
        //     text: window.siyuan.languages.sortByFiletree,
        //     value: "FileTree",
        // },
    ];
}

export function SETTING_DOCUMENT_LIST_DB_SORT_METHOD_ELEMENT(): { name: string, value: DocumentSortMode }[] {
    return [
        {
            name: window.siyuan.languages.modifiedASC,
            value: "UpdatedASC",
        },
        {
            name: window.siyuan.languages.modifiedDESC,
            value: "UpdatedDESC",
        },
        {
            name: window.siyuan.languages.createdASC,
            value: "CreatedASC",
        },
        {
            name: window.siyuan.languages.createdDESC,
            value: "CreatedDESC",
        },
        {
            name: window.siyuan.languages.fileNameASC,
            value: "NameASC",
        },
        {
            name: window.siyuan.languages.fileNameDESC,
            value: "NameDESC",
        },
        {
            name: window.siyuan.languages.fileNameNatASC,
            value: "AlphanumASC",
        },
        {
            name: window.siyuan.languages.fileNameNatDESC,
            value: "AlphanumDESC",
        },
        {
            name: window.siyuan.languages.refCountASC,
            value: "RefCountASC",
        },
        {
            name: window.siyuan.languages.refCountDESC,
            value: "RefCountDESC",
        },

    ];
}