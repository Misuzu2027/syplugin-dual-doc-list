type SettingDialogType =
    | "settingNotebook"  // 笔记本
    | "settingType" // 类型
    | "settingAttr" // 属性
    | "settingOther" // 其他
    | "settingHub"
    ;

type DocumentSortMode =
    | "NameASC"
    | "NameDESC"
    | "UpdatedASC"
    | "UpdatedDESC"
    | "AlphanumASC"
    | "AlphanumDESC"
    | "Custom"
    | "RefCountASC"
    | "RefCountDESC"
    | "CreatedASC"
    | "CreatedDESC"
    | "SizeASC"
    | "SizeDESC"
    | "SubDocCountASC"
    | "SubDocCountDESC"
    | "FileTree"
    ;



type ClickMode =
    | "click"
    | "doubleClick"
    ;