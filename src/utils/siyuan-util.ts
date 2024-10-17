import { EnvConfig } from "@/config/EnvConfig";
import { isArrayEmpty } from "@/utils/array-util";
import { isStrBlank, removePrefixAndSuffix } from "@/utils/string-util";

export function getActiveTab(): HTMLDivElement {
    let tab = document.querySelector("div.layout__wnd--active ul.layout-tab-bar>li.item--focus");
    let dataId: string = tab?.getAttribute("data-id");
    if (!dataId) {
        return null;
    }
    const activeTab: HTMLDivElement = document.querySelector(
        `.layout-tab-container.fn__flex-1>div.protyle[data-id="${dataId}"]`
    ) as HTMLDivElement;
    return activeTab;
}

export function highlightBlockContent(block: FileBlock, keywords: string[]) {
    if (!block || isArrayEmpty(keywords)) {
        return;
    }
    let contentHtml = getHighlightedContent(block.content, keywords);
    let nameHml = getHighlightedContent(block.name, keywords);
    let aliasHtml = getHighlightedContent(block.alias, keywords);
    let memoHtml = getHighlightedContent(block.memo, keywords);
    let tagHtml = getHighlightedContent(block.tag, keywords);
    block.content = contentHtml;
    block.name = nameHml;
    block.alias = aliasHtml;
    block.memo = memoHtml;
    block.tag = tagHtml;
}

export function getNodeId(node: Node | null): string | null {
    if (!node) {
        return null;
    }
    if (node instanceof Element) {
        const nodeId = (node as HTMLElement).getAttribute("data-node-id");
        if (nodeId) {
            return nodeId;
        }
    }
    // 递归查找父节点
    return getNodeId(node.parentNode);
}



let bgFadeTimeoutId: NodeJS.Timeout;

export function bgFade(element: Element) {
    if (bgFadeTimeoutId) {
        clearTimeout(bgFadeTimeoutId);
        bgFadeTimeoutId = null;
    }
    element.parentElement.querySelectorAll(".protyle-wysiwyg--hl").forEach((hlItem) => {
        hlItem.classList.remove("protyle-wysiwyg--hl");
    });
    element.classList.add("protyle-wysiwyg--hl");
    bgFadeTimeoutId = setTimeout(function () {
        element.classList.remove("protyle-wysiwyg--hl");
    }, 1536);
};

export function highlightContent(content: string, keywords: string[]): string {
    if (!content) {
        return content;
    }
    let contentHtml = getHighlightedContent(content, keywords);
    return contentHtml;
}

export function getHighlightedContent(
    content: string,
    keywords: string[],
): string {
    if (!content) {
        return content;
    }
    // let highlightedContent: string = escapeHtml(content);
    let highlightedContent: string = content;

    if (keywords) {
        highlightedContent = highlightMatches(highlightedContent, keywords);
    }
    return highlightedContent;
}

function highlightMatches(content: string, keywords: string[]): string {
    if (!keywords.length || !content) {
        return content; // 返回原始字符串，因为没有需要匹配的内容
    }

    const regexPattern = new RegExp(`(${keywords.join("|")})`, "gi");
    const highlightedString = content.replace(
        regexPattern,
        "<mark>$1</mark>",
    );
    return highlightedString;
}

export function parseDateTimeInBlock(dateTimeString: string): Date | null {
    if (dateTimeString.length !== 14) {
        console.error("Invalid date time string format. It should be 'yyyyMMddhhmmss'.");
        return null;
    }

    const year = parseInt(dateTimeString.slice(0, 4), 10);
    const month = parseInt(dateTimeString.slice(4, 6), 10) - 1; // 月份从 0 开始
    const day = parseInt(dateTimeString.slice(6, 8), 10);
    const hour = parseInt(dateTimeString.slice(8, 10), 10);
    const minute = parseInt(dateTimeString.slice(10, 12), 10);
    const second = parseInt(dateTimeString.slice(12, 14), 10);

    return new Date(year, month, day, hour, minute, second);
}


export function convertDateTimeInBlock(dateTimeString: string): string {
    if (dateTimeString.length !== 14) {
        console.error("Invalid date time string format. It should be 'yyyyMMddhhmmss'.");
        return null;
    }
    const year = dateTimeString.slice(0, 4);
    const month = dateTimeString.slice(4, 6);
    const day = dateTimeString.slice(6, 8);
    const hour = dateTimeString.slice(8, 10);
    const minute = dateTimeString.slice(10, 12);
    const second = dateTimeString.slice(12, 14);

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}



export function getFileArialLabel(fileBlock: FileBlock, boxName: string): string {
    let ariaLabelRow: string[] = [];
    ariaLabelRow.push(fileBlock.content);
    if (fileBlock.name) {
        ariaLabelRow.push(
            `\n${window.siyuan.languages.name} ${fileBlock.name}`,
        );
    }
    if (fileBlock.alias) {
        ariaLabelRow.push(
            `\n${window.siyuan.languages.alias} ${fileBlock.alias}`,
        );
    }
    if (fileBlock.tag) {
        ariaLabelRow.push(
            `\n${window.siyuan.languages.tag} ${fileBlock.tag}`,
        );
    }
    if (fileBlock.memo) {
        ariaLabelRow.push(
            `\n${window.siyuan.languages.memo} ${fileBlock.memo}`,
        );
    }

    ariaLabelRow.push(`<br>${EnvConfig.ins.i18n.notebook} ${boxName}`);
    if (fileBlock.hpath) {
        ariaLabelRow.push(`\n${EnvConfig.ins.i18n.path} ${fileBlock.hpath}`);
    }

    let subFileCount = fileBlock.subFileCount;
    if (subFileCount) {
        ariaLabelRow.push(`${window.siyuan.languages.includeSubFile.replace("x", subFileCount)} `);
    }

    let updated = fileBlock.updated;
    let created = fileBlock.created;
    if (updated.length === 14) {
        updated = convertDateTimeInBlock(fileBlock.updated);
        updated += ", " + formatRelativeTimeInBlock(fileBlock.updated);
    }
    if (created.length === 14) {
        created = convertDateTimeInBlock(fileBlock.created);
        created += ", " + formatRelativeTimeInBlock(fileBlock.created);
    }

    ariaLabelRow.push(
        `\n${window.siyuan.languages.modifiedAt} ${updated}`,
    );
    ariaLabelRow.push(
        `\n${window.siyuan.languages.createdAt} ${created}`,
    );

    let ariaLabel = ariaLabelRow.join("");
    ariaLabel = removePrefixAndSuffix(ariaLabel, "\n", "");

    return ariaLabel;
}


export function formatRelativeTimeInBlock(dateTimeString: string): string {
    let timestamp = parseDateTimeInBlock(dateTimeString).getTime();
    return formatRelativeTime(timestamp);
}



export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const month = 30 * day;
    const year = 365 * day;

    if (diff < minute) {
        return `${Math.floor(diff / 1000)}秒前`;
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < month) {
        return `${Math.floor(diff / day)}天前`;
    } else if (diff < year) {
        return `${Math.floor(diff / month)}个月前`;
    } else {
        return `${Math.floor(diff / year)}年前`;
    }
}


export function convertSordModeToNumber(sortMode: DocumentSortMode): number {
    let sortCode = null;
    switch (sortMode) {
        case "NameASC":
            sortCode = 0
            break;
        case "NameDESC":
            sortCode = 1;
            break;
        case "UpdatedASC":
            sortCode = 2;
            break;
        case "UpdatedDESC":
            sortCode = 3;
            break;
        case "AlphanumASC":
            sortCode = 4;
            break;
        case "AlphanumDESC":
            sortCode = 5;
            break;
        case "Custom":
            sortCode = 6;
            break;
        case "RefCountASC":
            sortCode = 7;
            break;
        case "RefCountDESC":
            sortCode = 8;
            break;
        case "CreatedASC":
            sortCode = 9;
            break;
        case "CreatedDESC":
            sortCode = 10;
            break;
        case "SizeASC":
            sortCode = 11;
            break;
        case "SizeDESC":
            sortCode = 12;
            break;
        case "SubDocCountASC":
            sortCode = 13;
            break;
        case "SubDocCountDESC":
            sortCode = 14;
            break;
        case "FileTree":
            sortCode = 15;
            break;
    }
    return sortCode;
}

export function convertNumberToSordMode(sortCode: number): DocumentSortMode {
    let sortMode = null;
    switch (sortCode) {
        case 0:
            sortMode = "NameASC";
            break;
        case 1:
            sortMode = "NameDESC";
            break;
        case 2:
            sortMode = "UpdatedASC";
            break;
        case 3:
            sortMode = "UpdatedDESC";
            break;
        case 4:
            sortMode = "AlphanumASC";
            break;
        case 5:
            sortMode = "AlphanumDESC";
            break;
        case 6:
            sortMode = "Custom";
            break;
        case 7:
            sortMode = "RefCountASC";
            break;
        case 8:
            sortMode = "RefCountDESC";
            break;
        case 9:
            sortMode = "CreatedASC";
            break;
        case 10:
            sortMode = "CreatedDESC";
            break;
        case 11:
            sortMode = "SizeASC";
            break;
        case 12:
            sortMode = "SizeDESC";
            break;
        case 13:
            sortMode = "SubDocCountASC";
            break;
        case 14:
            sortMode = "SubDocCountDESC";
            break;
        case 15:
            sortMode = "FileTree";
            break;
    }
    return sortMode;

}

export function isElementHidden(element: Element) {
    if (!element || element.tagName === "BODY") {
        return false;
    }

    if (element.classList.contains("fn__none")) {
        return true;
    }

    return isElementHidden(element.parentElement);
}


export function getParentPath(path: string): string {
    if (isStrBlank(path)) {
        return null;
    }
    // 将路径按斜杠分割
    const parts = path.split("/");

    if (parts.length <= 2) {
        console.log(`getParentPath oldPath : ${path}, newPath : /`)

        return "/"; // 如果没有多余的路径部分，返回根路径
    }

    // 获取倒数第二部分并保留其后缀
    const secondLast = parts[parts.length - 2];
    const last = parts[parts.length - 1];

    // 提取后缀，合并成新的路径
    const suffix = last.split(".").pop();

    let prefixPath = parts.slice(0, -2).join("/");

    let newLast = "";
    if (secondLast) {
        newLast = `/${secondLast}.${suffix}`;
    }

    let parentPath = prefixPath + newLast
    console.log(`getParentPath oldPath : ${path}, newPath : ${parentPath}`)

    return parentPath;
}



export function clearSyFileTreeItemFocusClass() {
    document
        .querySelector("div.file-tree.sy__file")
        .querySelectorAll("li.b3-list-item--focus")
        .forEach((liItem) => {
            liItem.classList.remove("b3-list-item--focus");
        });
}
