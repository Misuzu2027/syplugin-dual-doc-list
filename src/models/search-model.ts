export class DocumentItem {
    block: Block;
    subItems: BlockItem[];
    isCollapsed: boolean;
    icon: string;
    index: number;
    path: string;
    ariaLabel: string;
}

export class BlockItem {
    block: Block;
    icon: string;
    index: number;
}


export class DocumentSqlQueryModel {
    searchCriterion: DocumentQueryCriteria;
    documentItems: DocumentItem[];
    documentCount: number;
    status: "success" | "param_null";
}


export class DocumentQueryCriteria {
    parentDocId: string;
    showSubDocuments: boolean;
    keywords: string[];
    fullTextSearch: boolean;
    pages: number[];
    documentSortMethod: DocumentSortMode;
    includeTypes: string[];
    includeConcatFields: string[];
    includeRootIds: string[];
    includeNotebookIds: string[];

    constructor(
        docPath: string,
        showSubDocuments: boolean,
        keywords: string[],
        fullTextSearch: boolean,
        pages: number[],
        documentSortMethod: DocumentSortMode,
        includeTypes: string[],
        includeConcatFields: string[],
        includeNotebookIds: string[],
    ) {
        this.parentDocId = docPath;
        this.showSubDocuments = showSubDocuments;
        this.keywords = keywords;
        this.fullTextSearch = fullTextSearch;
        this.pages = pages;
        this.documentSortMethod = documentSortMethod;
        this.includeTypes = includeTypes;
        this.includeConcatFields = includeConcatFields;
        this.includeNotebookIds = includeNotebookIds;
    }
}
