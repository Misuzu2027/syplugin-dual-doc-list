import { EnvConfig } from "@/config/EnvConfig";
import { BlockItem, DocumentQueryCriteria } from "@/models/search-model";
import { getBlockIndex, getBlocksIndexes, listDocsByPath, listDocTree, sql } from "@/utils/api";
import { isArrayEmpty, isArrayNotEmpty } from "@/utils/array-util";
import { convertIalStringToObject, convertIconInIal } from "@/utils/icon-util";
import { containsAllKeywords, isStrBlank, isStrNotBlank, } from "@/utils/string-util";
import { generateDocumentListSql, generateGetRootBlockCountSql } from "./search-sql";
import { DocumentTreeItemInfo } from "@/models/document-model";
import { convertSordModeToNumber, getFileArialLabel, highlightBlockContent } from "@/utils/siyuan-util";
import { SiyuanConstants } from "@/models/siyuan-constant";
import { SettingService } from "../setting/SettingService";
import { isNumberNotValid, isNumberValid } from "@/utils/number-util";


export async function queryDocumentByPath(
    notebookId: string,
    docPath: string,
    keywords: string[],
    docSortMethod: DocumentSortMode,
): Promise<DocumentTreeItemInfo[]> {
    const startTime = performance.now(); // 记录开始时间
    let sortNumber = convertSordModeToNumber(docSortMethod);
    let data = await listDocsByPath(notebookId, docPath, sortNumber, null, null, null);
    let docBlockArray: FileBlock[] = [];
    for (const file of data.files) {
        let fileBlock: FileBlock = {
            id: file.id,
            box: data.box,
            content: file.name.replace(/\.sy$/, ""),
            name: file.name1,
            alias: file.alias,
            memo: file.memo,
            bookmark: file.bookmark,
            path: file.path,

            icon: file.icon,
            refCount: file.count,
            subFileCount: file.subFileCount,
            sort: file.sort,

            created: file.hCtime,
            updated: file.hMtime,
            hSize: file.hSize,

            dueFlashcardCount: file.flashcardCount,
            newFlashcardCount: file.flashcardCount,
            flashcardCount: file.flashcardCount,
        };
        docBlockArray.push(fileBlock);
    }

    let documentItems = processQueryResults(
        docBlockArray,
        keywords,
        true,
    );

    const endTime = performance.now(); // 记录结束时间
    const executionTime = endTime - startTime; // 计算时间差
    console.log(
        `通过文件路径接口或取文档列表 : ${executionTime} ms `,
    );
    return documentItems;
}

export async function queryDocumentByDb(
    notebookId: string,
    parentDocId: string,
    docPath: string,
    keywords: string[],
    showSubDocuments: boolean,
    fullTextSearch: boolean,
    docSortMethod: DocumentSortMode,
): Promise<DocumentTreeItemInfo[]> {
    let settingConfig = SettingService.ins.SettingConfig;
    const startTime = performance.now(); // 记录开始时间
    let includeConcatFields = settingConfig.includeConcatFields;
    let fullTextSearchBlockType = settingConfig.fullTextSearchBlockType;

    let includeNotebookIds = [];
    if (isStrNotBlank(notebookId)) {
        includeNotebookIds.push(notebookId);
    }

    let pages = [1, 9999999];

    // 如果笔记本id和文档id都为空，表示查询所有文档，此时需要限制数量。
    if (isStrBlank(notebookId) && isStrBlank(parentDocId)) {
        pages[1] = settingConfig.allDocsQueryLimit;
    }

    let queryCriteria: DocumentQueryCriteria = new DocumentQueryCriteria(
        parentDocId,
        showSubDocuments,
        keywords,
        fullTextSearch,
        pages,
        docSortMethod,
        fullTextSearchBlockType,
        includeConcatFields,
        includeNotebookIds,
    );

    let documentListSql = generateDocumentListSql(queryCriteria);
    let fileBlockResults: FileBlock[] = await sql(documentListSql);

    await Promise.all([
        setBlockRefCount(fileBlockResults),
        setBlockSubFileCount(fileBlockResults, notebookId, docPath)
    ]);

    let documentItems = processQueryResults(
        fileBlockResults,
        keywords,
        false,
    );

    if (docSortMethod.startsWith("Alphanum") || docSortMethod.startsWith("SubDocCount")) {
        documentSort(documentItems, docSortMethod);
    }

    const endTime = performance.now(); // 记录结束时间
    const executionTime = endTime - startTime; // 计算时间差
    console.log(
        `通过数据库获取文档列表 : ${executionTime} ms `,
    );

    return documentItems;
}

async function setBlockRefCount(fileBlockResults: FileBlock[]) {
    const startTime = performance.now(); // 记录开始时间
    if (isArrayEmpty(fileBlockResults)) {
        return;
    }
    let ids = [];
    for (const block of fileBlockResults) {
        if (block && isNumberNotValid(block.refCount)) {
            ids.push(block.id);
        }
    }
    if (isArrayEmpty(ids)) {
        return;
    }
    let getRootBlockCountSql = generateGetRootBlockCountSql(ids);
    let refCountArray = await sql(getRootBlockCountSql);
    let refCountMap = new Map<string, number>();
    for (const item of refCountArray) {
        refCountMap.set(item.def_block_root_id, item.count);
    }
    for (const block of fileBlockResults) {
        let refCount = refCountMap.get(block.id);
        if (block && isNumberValid(refCount)) {
            block.refCount = refCount;
        }
    }


    const endTime = performance.now(); // 记录结束时间
    const executionTime = endTime - startTime; // 计算时间差
    console.log(
        `设置文档引用数量 处理时间 : ${executionTime} ms `,
    );
}

async function setBlockSubFileCount(fileBlockResults: FileBlock[], notebookId: NotebookId, docPath: string) {
    const startTime = performance.now(); // 记录开始时间
    if (isArrayEmpty(fileBlockResults)) {
        return;
    }
    let notebookPathSet = new Set<string>();
    if (isStrNotBlank(notebookId)) {
        let path = "";
        if (isStrNotBlank(docPath)) {
            path = removeLastPathSegment(path);
        }
        let np = notebookId + "::" + path;
        notebookPathSet.add(np);
    } else {
        for (const document of fileBlockResults) {
            let box = document.box;
            let path = document.path;
            if (!EnvConfig.ins.notebookMap.has(box)) {
                continue;
            }
            if (isStrNotBlank(path)) {
                path = removeLastPathSegment(path);
            }
            let np = box + "::" + path;
            notebookPathSet.add(np);
        }
        notebookPathSet = findShortestPaths(notebookPathSet);
    }
    let docTreePromises = [];
    for (const np of notebookPathSet) {
        let nps = np.split("::");
        let apiPromise = listDocTree(nps[0], nps[1]);
        docTreePromises.push(apiPromise);
    }
    let docTreeArray: IDocTreeResp[] = await Promise.all(docTreePromises);
    let docSubCountMap = docTreeRespArrayToMap(docTreeArray);

    for (const document of fileBlockResults) {
        let subFileCount = docSubCountMap.get(document.id);
        subFileCount = subFileCount ? subFileCount : 0;
        document.subFileCount = subFileCount;
    }
    const endTime = performance.now(); // 记录结束时间
    const executionTime = endTime - startTime; // 计算时间差
    console.log(
        `设置文档子文档数量方法 发送请求数量 ${docTreePromises.length}，笔记本数量 ${EnvConfig.ins.notebookMap.size}，处理时间 : ${executionTime} ms `,
    );

}

function docTreeRespArrayToMap(resps: IDocTreeResp[]): Map<string, number> {
    const result = new Map<string, number>();

    // 递归遍历每个节点
    function traverse(nodes: ITreeNode[]) {
        for (const node of nodes) {
            const childrenCount = node.children ? node.children.length : 0;
            result.set(node.id, childrenCount);

            // 如果有子节点，递归处理
            if (node.children && node.children.length > 0) {
                traverse(node.children);
            }
        }
    }

    // 从根节点开始遍历
    for (const resp of resps) {
        if (resp && resp.tree) {
            traverse(resp.tree);
        }
    }

    return result;
}
function removeLastPathSegment(path: string): string {
    // 使用最后一个斜杠将路径分割成数组
    const segments = path.split('/');

    // 如果数组长度小于等于1，返回原路径
    if (segments.length <= 1) {
        return "/";
    }

    // 去掉最后一个路径部分并重新组合路径
    segments.pop(); // 移除最后一个部分
    return segments.join('/'); // 重新组合路径
}


function findShortestPaths(paths: Set<string>): Set<string> {
    // 创建一个 Map 用于存储以每个路径的开头部分作为键，路径数组作为值
    const pathMap = new Map<string, string[]>();

    paths.forEach(path => {
        // 以路径的第一部分（根节点）作为键
        const root = path.split('/')[0];  // 取第一个 id 节点
        if (!pathMap.has(root)) {
            pathMap.set(root, []);
        }
        pathMap.get(root)!.push(path);
    });

    // 遍历 Map，找到每组中最短的路径
    const shortestPaths: Set<string> = new Set<string>();
    pathMap.forEach((groupedPaths, root) => {
        const shortestPath = groupedPaths.reduce((shortest, current) =>
            current.length < shortest.length ? current : shortest
        );
        shortestPaths.add(shortestPath);
    });

    return shortestPaths;
}



function processQueryResults(
    fileBlockArray: FileBlock[],
    keywordArray: string[],
    isFilteredByKeyword: boolean
): DocumentTreeItemInfo[] {
    if (isArrayEmpty(fileBlockArray)) {
        return [];
    }

    let documentBlockInfos: DocumentTreeItemInfo[] = [];

    let index = 0;
    for (const fileBlock of fileBlockArray) {
        if (!fileBlock) {
            continue;
        }
        if (isFilteredByKeyword && isArrayNotEmpty(keywordArray)) {
            let fileBlockConcat =
                fileBlock.content +
                fileBlock.name +
                fileBlock.alias +
                fileBlock.memo +
                fileBlock.alias +
                fileBlock.memo +
                fileBlock.bookmark;
            if (!containsAllKeywords(fileBlockConcat, keywordArray)) {
                continue;
            }
        }
        highlightBlockContent(fileBlock, keywordArray);

        let icon = convertIconInIal(SiyuanConstants.SIYUAN_IMAGE_FILE);
        if (fileBlock.subFileCount && fileBlock.subFileCount > 0) {
            icon = convertIconInIal(SiyuanConstants.SIYUAN_IMAGE_FOLDER);
        }
        if (fileBlock.ial) {
            let ial = convertIalStringToObject(fileBlock.ial);
            icon = convertIconInIal(ial.icon);
        } else if (fileBlock.icon) {
            icon = convertIconInIal(fileBlock.icon);
        }

        let notebookInfo = EnvConfig.ins.notebookMap.get(fileBlock.box);
        let boxName = fileBlock.box;
        if (notebookInfo) {
            boxName = notebookInfo.name;
        }
        let refCount = fileBlock.refCount;

        let ariaLabel = getFileArialLabel(fileBlock, boxName);
        let documentBlockInfo = new DocumentTreeItemInfo();
        documentBlockInfo.fileBlock = fileBlock;

        documentBlockInfo.icon = icon;
        documentBlockInfo.boxName = boxName;
        documentBlockInfo.refCount = refCount;
        documentBlockInfo.ariaLabel = ariaLabel;
        documentBlockInfo.index = index;
        documentBlockInfos.push(documentBlockInfo);
        index++;
    }


    return documentBlockInfos;
}



function processPath(input: string): string {
    const lastSlashIndex = input.lastIndexOf("/"); // 找到最后一个斜杠的位置
    const lastDotIndex = input.lastIndexOf("."); // 找到最后一个点的位置

    if (
        lastSlashIndex === -1 ||
        lastDotIndex === -1 ||
        lastSlashIndex == 0
    ) {
        return "/";
    }

    if (lastSlashIndex < lastDotIndex) {
        // 如果最后一个斜杠在最后一个点之前，说明是符合的路径
        return (
            input.substring(0, lastSlashIndex) +
            input.substring(lastDotIndex)
        );
    }
    return "/";
}

export function isQueryDocByPathApi(
    showSubDocuments: boolean,
    notebookId: string,
    docPath: string,
    keywords: string[],
    fullTextSearch: boolean,
): boolean {
    // return false;
    // 满足以下情况使用路径查询子文档
    //  不查询子文档的子文档
    //  notebookId 和 docPath 不为空
    //  （关键字为空 或 不使用全文搜索）
    return (
        !showSubDocuments &&
        isStrNotBlank(notebookId) &&
        isStrNotBlank(docPath) &&
        (isArrayEmpty(keywords) || !fullTextSearch)
    );
}

export function selectItemByArrowKeys(
    event: KeyboardEvent,
    selectedItemIndex: number,
    documentItems: DocumentTreeItemInfo[],
): DocumentTreeItemInfo {
    let selectedItem: DocumentTreeItemInfo = null;

    if (!event || !event.key) {
        return selectedItem;
    }
    let keydownKey = event.key;
    if (
        keydownKey !== "ArrowUp" &&
        keydownKey !== "ArrowDown" &&
        keydownKey !== "Enter"
    ) {
        return selectedItem;
    }
    if (selectedItemIndex == null || selectedItemIndex == undefined) {
        selectedItemIndex = 0;
    }

    event.stopPropagation();

    if (event.key === "ArrowUp") {
        if (selectedItemIndex > 0) {
            selectedItemIndex -= 1;
        }
    } else if (event.key === "ArrowDown") {
        let lastDocumentItem = documentItems[documentItems.length - 1];
        if (!lastDocumentItem) {
            return selectedItem;
        }
        let lastIndex = lastDocumentItem.index;
        if (selectedItemIndex < lastIndex) {
            selectedItemIndex += 1;
        }
    }
    for (const item of documentItems) {
        if (selectedItemIndex == item.index) {
            selectedItem = item;
            break;
        }
    }

    return selectedItem;
}


function documentSort(searchResults: DocumentTreeItemInfo[], documentSortMethod: DocumentSortMode) {
    // 文档排序
    let documentSortFun = getDocumentSortFun(documentSortMethod);
    searchResults.sort(documentSortFun);
}

function getDocumentSortFun(documentSortMethod: DocumentSortMode)
    : (
        a: DocumentTreeItemInfo,
        b: DocumentTreeItemInfo,
    ) => number {
    let documentSortFun: (
        a: DocumentTreeItemInfo,
        b: DocumentTreeItemInfo,
    ) => number;

    switch (documentSortMethod) {
        case "UpdatedASC":
            documentSortFun = function (
                a: DocumentTreeItemInfo,
                b: DocumentTreeItemInfo,
            ): number {
                let rank = getDocumentBlockRankDescSort(a, b);
                if (rank != 0) {
                    return rank;
                }
                return Number(a.fileBlock.updated) - Number(b.fileBlock.updated);
            };
            break;
        case "UpdatedDESC":
            documentSortFun = function (
                a: DocumentTreeItemInfo,
                b: DocumentTreeItemInfo,
            ): number {
                let rank = getDocumentBlockRankDescSort(a, b);
                if (rank != 0) {
                    return rank;
                }
                return Number(b.fileBlock.updated) - Number(a.fileBlock.updated);
            };
            break;
        case "CreatedASC":
            documentSortFun = function (
                a: DocumentTreeItemInfo,
                b: DocumentTreeItemInfo,
            ): number {
                let rank = getDocumentBlockRankDescSort(a, b);
                if (rank != 0) {
                    return rank;
                }
                return Number(a.fileBlock.created) - Number(b.fileBlock.created);
            };
            break;
        case "CreatedDESC":
            documentSortFun = function (
                a: DocumentTreeItemInfo,
                b: DocumentTreeItemInfo,
            ): number {
                let rank = getDocumentBlockRankDescSort(a, b);
                if (rank != 0) {
                    return rank;
                }
                return Number(b.fileBlock.created) - Number(a.fileBlock.created);
            };
            break;
        case "AlphanumASC":
            documentSortFun = function (
                a: DocumentTreeItemInfo,
                b: DocumentTreeItemInfo,
            ): number {
                let rank = getDocumentBlockRankDescSort(a, b);
                if (rank != 0) {
                    return rank;
                }

                let aContent = a.fileBlock.content.replace("<mark>", "").replace("</mark>", "");
                let bContent = b.fileBlock.content.replace("<mark>", "").replace("</mark>", "");
                let result = aContent.localeCompare(bContent, undefined, { sensitivity: 'base', usage: 'sort', numeric: true });
                if (result == 0) {
                    result = Number(b.fileBlock.updated) - Number(a.fileBlock.updated);
                }
                return result;
            };
            break;
        case "AlphanumDESC":
            documentSortFun = function (
                a: DocumentTreeItemInfo,
                b: DocumentTreeItemInfo,
            ): number {
                let rank = getDocumentBlockRankDescSort(a, b);
                if (rank != 0) {
                    return rank;
                }
                let aContent = a.fileBlock.content.replace("<mark>", "").replace("</mark>", "");
                let bContent = b.fileBlock.content.replace("<mark>", "").replace("</mark>", "");
                let result = bContent.localeCompare(aContent, undefined, { sensitivity: 'base', usage: 'sort', numeric: true });
                if (result == 0) {
                    result = Number(b.fileBlock.updated) - Number(a.fileBlock.updated);
                }
                return result;
            };
            break;
        case "SubDocCountASC":
            documentSortFun = function (
                a: DocumentTreeItemInfo,
                b: DocumentTreeItemInfo,
            ): number {
                let rank = getDocumentBlockRankDescSort(a, b);
                if (rank != 0) {
                    return rank;
                }
                let result = a.fileBlock.subFileCount - b.fileBlock.subFileCount
                if (result == 0) {
                    result = Number(b.fileBlock.updated) - Number(a.fileBlock.updated);
                }
                return result;
            };
            break;
        case "SubDocCountDESC":
            documentSortFun = function (
                a: DocumentTreeItemInfo,
                b: DocumentTreeItemInfo,
            ): number {
                let rank = getDocumentBlockRankDescSort(a, b);
                if (rank != 0) {
                    return rank;
                }
                let result = b.fileBlock.subFileCount - a.fileBlock.subFileCount;
                if (result == 0) {
                    result = Number(b.fileBlock.updated) - Number(a.fileBlock.updated);
                }
                return result;
            };
            break;
    }
    return documentSortFun;
}

function getDocumentBlockRankDescSort(a: DocumentTreeItemInfo, b: DocumentTreeItemInfo): number {
    let aRank: number = calculateBlockRank(a.fileBlock);
    let bRank: number = calculateBlockRank(b.fileBlock);
    let result = bRank - aRank;
    return result;
}

function calculateBlockRank(block: any): number {

    let includeAttrFields = SettingService.ins.SettingConfig.includeConcatFields;
    let rank = block.content.split("<mark>").length - 1;

    if (includeAttrFields.includes("name")) {
        rank += block.name.split("<mark>").length - 1;
    }
    if (includeAttrFields.includes("alias")) {
        rank += block.alias.split("<mark>").length - 1;
    }
    if (includeAttrFields.includes("memo")) {
        rank += block.memo.split("<mark>").length - 1;
    }
    return rank;
}


function countKeywords(content: string, keywords: string[]): number {
    let count = 0;
    keywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi'); // 创建全局、不区分大小写的正则表达式
        const matches = content.match(regex); // 在文本中查找匹配的关键字
        if (matches) {
            count += matches.length; // 更新匹配关键字的数量
        }
    });
    return count;
}



async function searchItemSortByContent(blockItems: BlockItem[]) {

    let ids = blockItems.map(item => item.block.id);
    let idMap: Map<BlockId, number> = await getBatchBlockIdIndex(ids);
    blockItems.sort((a, b) => {
        if (a.block.type === "d") {
            return -1;
        }
        if (b.block.type === "d") {
            return 1;
        }
        let aIndex = idMap.get(a.block.id) || 0;
        let bIndex = idMap.get(b.block.id) || 0;
        let result = aIndex - bIndex;
        if (result == 0) {
            result = Number(a.block.created) - Number(b.block.created);
        }
        if (result == 0) {
            result = a.block.sort - b.block.sort;
        }
        return result;
    });

    return blockItems;
}


async function searchItemSortByTypeAndContent(blockItems: BlockItem[]) {
    let ids = blockItems.map(item => item.block.id);
    let idMap: Map<BlockId, number> = await getBatchBlockIdIndex(ids);
    blockItems.sort((a, b) => {
        if (a.block.type === "d") {
            return -1;
        }
        if (b.block.type === "d") {
            return 1;
        }
        let result = a.block.sort - b.block.sort;
        if (result == 0) {
            let aIndex = idMap.get(a.block.id) || 0;
            let bIndex = idMap.get(b.block.id) || 0;
            result = aIndex - bIndex;
        }
        if (result == 0) {
            result = Number(a.block.created) - Number(b.block.created);
        }
        return result;
    });

    return blockItems;
}

async function getBatchBlockIdIndex(ids: string[]): Promise<Map<BlockId, number>> {
    let idMap: Map<string, number> = new Map();
    let getSuccess = true;
    try {
        let idObject = await getBlocksIndexes(ids);
        // 遍历对象的键值对，并将它们添加到 Map 中
        for (const key in idObject) {
            if (Object.prototype.hasOwnProperty.call(idObject, key)) {
                const value = idObject[key];
                idMap.set(key, value);
            }
        }
    } catch (err) {
        getSuccess = false;
        console.error("批量获取块索引报错，可能是旧版本不支持批量接口 : ", err)
    }

    if (!getSuccess) {
        for (const id of ids) {
            let index = 0
            try {
                index = await getBlockIndex(id);
            } catch (err) {
                console.error("获取块索引报错 : ", err)
            }
            idMap.set(id, index)
        }
    }

    return idMap;
}


