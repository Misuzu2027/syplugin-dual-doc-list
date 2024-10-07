import { DocumentQueryCriteria } from "@/models/search-model";
import { isArrayNotEmpty } from "@/utils/array-util";
import { isStrBlank, isStrNotBlank } from "@/utils/string-util";



export function generateDocumentListSql(
    queryCriteria: DocumentQueryCriteria,
): string {

    let parentDocId = queryCriteria.parentDocId;
    let showSubDocuments = queryCriteria.showSubDocuments;
    let keywords = queryCriteria.keywords;
    let fullTextSearch = queryCriteria.fullTextSearch;
    let pages = queryCriteria.pages;
    let includeNotebookIds = queryCriteria.includeNotebookIds;
    let documentSortMethod = queryCriteria.documentSortMethod;
    let includeConcatFields = queryCriteria.includeConcatFields;
    let columns: string[] = [
        // " * "
        " id, root_id, box, path, hpath, name, alias, memo, tag, content, ial, created, updated ",

        //  子文档数量查询sql，太影响性能了
        // ` ( SELECT count( 1 ) FROM blocks sub WHERE type = 'd' AND path = REPLACE(blocks.path,'.sy','/') || id || '.sy'  ) subDocCount `
    ];


    let boxInSql = " "
    if (isArrayNotEmpty(includeNotebookIds)) {
        boxInSql = generateAndInConditions("box", includeNotebookIds);
        if (showSubDocuments) {

        } else if (isStrBlank(parentDocId)) {
            boxInSql += ` AND path = '/' || id || '.sy' `
        }
    }

    let pathLikeSql = " ";
    if (isStrNotBlank(parentDocId)) {
        if (showSubDocuments) {
            pathLikeSql = ` AND path LIKE '%/${parentDocId}/%'`;
        } else {
            pathLikeSql = ` AND path LIKE '%/${parentDocId}/' || id || '.sy' `;
        }
    }


    let contentParamSql = " ";

    if (keywords && keywords.length > 0) {
        let concatConcatFieldSql = getConcatFieldSql("concatContent", includeConcatFields);
        columns.push(` ${concatConcatFieldSql} `);
        if (fullTextSearch) {
            let documentIdSql = generateDocumentIdContentTableSql(queryCriteria);
            contentParamSql = ` AND id in (${documentIdSql}) `;
        } else {
            contentParamSql = " AND " + generateAndLikeConditions("concatContent", keywords);
        }
    }

    let orders = [];

    if (keywords && keywords.length > 0) {
        let orderCaseCombinationSql = generateRelevanceOrderSql("concatContent", keywords, false);
        orders = [orderCaseCombinationSql];
    }
    if (documentSortMethod == 'UpdatedASC') {
        orders.push([" updated ASC "]);
    } else if (documentSortMethod == 'UpdatedDESC') {
        orders.push([" updated DESC "]);
    } else if (documentSortMethod == 'CreatedASC') {
        orders.push([" created ASC "]);
    } else if (documentSortMethod == 'CreatedDESC') {
        orders.push([" created DESC "]);
    } else if (documentSortMethod == 'RefCountASC') {
        columns.push(` (SELECT count(1) FROM refs WHERE def_block_root_id = blocks.id) refCount `);
        orders.push([" refCount ASC ", " updated DESC "]);
    } else if (documentSortMethod == 'RefCountDESC') {
        columns.push(` (SELECT count(1) FROM refs WHERE def_block_root_id = blocks.id) refCount `);
        orders.push([" refCount DESC ", " updated DESC "]);
    } else if (documentSortMethod == 'NameASC') {
        orders.push([" content ASC "]);
    } else if (documentSortMethod == 'NameDESC') {
        orders.push([" content DESC "]);
    } else {
        orders.push([" updated DESC "]);
    }

    let columnSql = columns.join(" , ");
    let orderSql = generateOrderSql(orders);
    let limitSql = generateLimitSql(pages);


    let basicSql = `
    SELECT
      ${columnSql}

    FROM
        blocks 
    WHERE
        type = 'd' 
        ${boxInSql}
        ${pathLikeSql}
        ${contentParamSql}

    ${orderSql}
    ${limitSql}
    `

    return cleanSpaceText(basicSql);
}



export function generateGetRootBlockCountSql(
    rootIds: string[],
): string {


    let columns: string[] = [" def_block_root_id ", "count(1) count"];


    let defBlockRootIdIn = " "
    if (isArrayNotEmpty(rootIds)) {
        defBlockRootIdIn = generateAndInConditions("def_block_root_id", rootIds);

    }

    let columnSql = columns.join(" , ");
    let basicSql = `
    SELECT 
         ${columnSql}
    FROM refs
    WHERE 1 = 1  
        ${defBlockRootIdIn}
    GROUP BY def_block_root_id
    `

    return cleanSpaceText(basicSql);
}




function generateDocumentIdContentTableSql(
    queryCriteria: DocumentQueryCriteria
): string {
    let keywords = queryCriteria.keywords;
    let includeTypes = queryCriteria.includeTypes;
    let includeConcatFields = queryCriteria.includeConcatFields;
    let includeRootIds = queryCriteria.includeRootIds;
    let includeNotebookIds = queryCriteria.includeNotebookIds;
    let excludeNotebookIds = [];

    let concatDocumentConcatFieldSql = getConcatFieldSql(null, includeConcatFields);
    let columns = ["root_id"]
    let contentLikeField = `GROUP_CONCAT( ${concatDocumentConcatFieldSql} )`;

    let orders = [];


    let documentIdContentTableSql = generateDocumentContentLikeSql(
        columns, keywords, contentLikeField, includeTypes, includeRootIds, includeNotebookIds, excludeNotebookIds, orders, null);

    return documentIdContentTableSql;
}

function generateDocumentContentLikeSql(
    columns: string[],
    keywords: string[],
    contentLikeField: string,
    includeTypes: string[],
    includeRootIds: string[],
    includeNotebookIds: string[],
    excludeNotebookIds: string[],
    orders: string[],
    pages: number[]): string {

    let columnSql = columns.join(",");
    let typeInSql = generateAndInConditions("type", includeTypes);
    let rootIdInSql = " ";
    let boxInSql = " ";
    let boxNotInSql = " ";
    // 如果文档id不为空，则忽略过滤的笔记本id。
    if (includeRootIds && includeRootIds.length > 0) {
        rootIdInSql = generateAndInConditions("root_id", includeRootIds);
    } else if (includeNotebookIds && includeNotebookIds.length > 0) {
        boxInSql = generateAndInConditions("box", includeNotebookIds);
    } else {
        boxNotInSql = generateAndNotInConditions("box", excludeNotebookIds);
    }

    // let contentOrLikeSql = generateOrLikeConditions("content", keywords);
    // if (contentOrLikeSql) {
    //     contentOrLikeSql = ` AND ( ${contentOrLikeSql} ) `;
    // }
    let aggregatedContentAndLikeSql = generateAndLikeConditions(
        ` ${contentLikeField} `,
        keywords,
    );
    if (aggregatedContentAndLikeSql) {
        aggregatedContentAndLikeSql = ` AND ( ${aggregatedContentAndLikeSql} ) `;
    }

    let orderSql = generateOrderSql(orders);

    let limitSql = generateLimitSql(pages);


    let sql = `  
        SELECT ${columnSql} 
        FROM
            blocks 
        WHERE
            1 = 1 
            ${typeInSql}
            ${rootIdInSql}
            ${boxInSql}
            ${boxNotInSql}
        GROUP BY
            root_id 
        HAVING
            1 = 1 
            ${aggregatedContentAndLikeSql}
        ${orderSql}
        ${limitSql}
    `;
    return sql;
}

function getConcatFieldSql(asFieldName: string, fields: string[]): string {
    if (!fields || fields.length <= 0) {
        return "";
    }
    // let sql = ` ( ${fields.join(" || ' '  || ")} ) `;
    let sql = ` ( ${fields.join(" || ")} ) `
    if (asFieldName) {
        sql += ` AS ${asFieldName} `;
    }

    return sql;
}

function cleanSpaceText(inputText: string): string {
    // 去除换行
    let cleanedText = inputText.replace(/[\r\n]+/g, ' ');

    // 将多个空格转为一个空格
    cleanedText = cleanedText.replace(/\s+/g, ' ');

    // 去除首尾空格
    cleanedText = cleanedText.trim();

    return cleanedText;
}

function generateOrLikeConditions(
    fieldName: string,
    params: string[],
): string {
    if (params.length === 0) {
        return " ";
    }

    const conditions = params.map(
        (param) => `${fieldName} LIKE '%${param}%'`,
    );
    const result = conditions.join(" OR ");

    return result;
}

function generateAndLikeConditions(
    fieldName: string,
    params: string[],
): string {
    if (params.length === 0) {
        return " ";
    }

    const conditions = params.map(
        (param) => `${fieldName}  LIKE '%${param}%'`,
    );
    const result = conditions.join(" AND ");

    return result;
}

function generateAndInConditions(
    fieldName: string,
    params: string[],
): string {
    if (!params || params.length === 0) {
        return " ";
    }
    let result = ` AND ${fieldName} IN (`
    const conditions = params
        .filter(param => isStrNotBlank(param))
        .map(param => `'${param}'`);
    result = result + conditions.join(" , ") + " ) ";

    return result;
}

function generateAndNotInConditions(
    fieldName: string,
    params: string[],
): string {
    if (!params || params.length === 0) {
        return " ";
    }
    let result = ` AND ${fieldName} NOT IN (`
    const conditions = params.map(
        (param) => ` '${param}' `,
    );
    result = result + conditions.join(" , ") + " ) ";

    return result;
}


function generateOrderCaseCombination(columnName: string, keywords: string[], orderAsc: boolean, index?: number, iterationOffset?: number): string {
    let whenCombinationSql = "";
    if (!index) {
        index = 0;
    }
    let endIndex = keywords.length;
    if (iterationOffset != null) {
        endIndex = endIndex - Math.abs(iterationOffset);
    }

    for (; index < endIndex; index++) {
        let combination = keywords.length - index;
        whenCombinationSql += generateWhenCombination(columnName, keywords, combination) + index;
    }

    let caseCombinationSql = "";
    if (whenCombinationSql) {
        let sortDirection = orderAsc ? " ASC " : " DESC ";
        caseCombinationSql = `(
        CASE 
            ${whenCombinationSql}
        ELSE 99
        END ) ${sortDirection}
    `;
    }
    return caseCombinationSql;
}

function generateWhenCombination(columnName: string, keywords: string[], combinationCount: number): string {
    if (combinationCount < 1 || combinationCount > keywords.length) {
        return "";
    }
    const combinations: string[][] = [];
    // 生成所有可能的组合
    const generateCombinations = (current: string[], start: number) => {
        if (current.length === combinationCount) {
            combinations.push([...current]);
            return;
        }
        for (let i = start; i < keywords.length; i++) {
            current.push(keywords[i]);
            generateCombinations(current, i + 1);
            current.pop();
        }
    };
    generateCombinations([], 0);
    // 生成查询字符串
    const queryString = combinations
        .map((combination) => {
            const conditions = combination.map((item) => ` ${columnName} LIKE '%${item}%' `).join(" AND ");
            return `(${conditions})`;
        })
        .join(" OR ");

    return ` WHEN ${queryString} THEN `;
}


function generateRelevanceOrderSql(columnName: string, keywords: string[], orderAsc: boolean): string {
    let subSql = "";

    for (let i = 0; i < keywords.length; i++) {
        let key = keywords[i];
        subSql += ` (${columnName} LIKE '%${key}%') `;
        if (i < keywords.length - 1) {
            subSql += ' + ';
        }
    }

    let orderSql = "";
    if (subSql) {
        let sortDirection = orderAsc ? " ASC " : " DESC ";
        orderSql = `( ${subSql} ) ${sortDirection}`;
    }
    return orderSql;
}


function generateOrderSql(orders: string[]): string {
    let orderSql = '';
    if (orders) {
        orders = orders.filter((order) => order);
        let orderParam = orders.join(",");
        if (orderParam) {
            orderSql = ` ORDER BY ${orderParam} `;
        }
    }
    return orderSql;
}

function generateLimitSql(pages: number[]): string {
    let limitSql = '';
    if (pages) {
        const limit = pages[1];
        if (pages.length == 1) {
            limitSql = ` LIMIT ${limit} `;
        } else if (pages.length == 2) {
            const offset = (pages[0] - 1) * pages[1];
            limitSql = ` LIMIT ${limit} OFFSET ${offset} `;
        }
    }
    return limitSql;
}