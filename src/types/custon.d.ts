type FileBlock = {
    id: string;
    box: string;
    content: string;
    name: string;
    alias: string;
    memo: string;
    bookmark?: string;
    tag?: string;
    path: string;
    hpath?: string;

    icon?: string;
    ial?: string;

    refCount: number;
    subFileCount?: number;

    sort: number;

    created: string;
    updated: string;
    hMtime?: string;
    hCtime?: string;
    hSize?: string;

    dueFlashcardCount?: string;
    newFlashcardCount?: string;
    flashcardCount?: string;
}


type IItemPropertyType =
    "select" |
    "text" |
    "number" |
    "button" |
    "textarea" |
    "switch" |
    "order" |
    "tips";