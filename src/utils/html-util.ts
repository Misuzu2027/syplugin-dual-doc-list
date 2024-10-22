import { isArrayEmpty } from "./array-util";
import { isNumberValid } from "./number-util";
import { isStrBlank } from "./string-util";

export const escapeAttr = (html: string) => {
    if (isStrBlank(html)) {
        return null;
    }
    return html.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
};

export function escapeHTML(html: string): string {
    let length = html.length;
    let start = 0;
    let i = 0;
    let inited = false;

    let ret: Uint8Array | string = html;

    const amp = new TextEncoder().encode('&amp;');
    const lt = new TextEncoder().encode('&lt;');
    const gt = new TextEncoder().encode('&gt;');
    const quot = new TextEncoder().encode('&quot;');

    const htmlBytes = new TextEncoder().encode(html);

    for (; i < length; i++) {
        switch (html.charCodeAt(i)) {
            case 38: // '&' ASCII
                if (!inited) {
                    ret = new Uint8Array(length + 128);
                    inited = true;
                    (ret as Uint8Array).set(htmlBytes.subarray(0, i), 0);
                }
                ret = concatUint8Array(ret as Uint8Array, htmlBytes.subarray(start, i));
                ret = concatUint8Array(ret as Uint8Array, amp);
                start = i + 1;
                break;
            case 60: // '<' ASCII
                if (!inited) {
                    ret = new Uint8Array(length + 128);
                    inited = true;
                    (ret as Uint8Array).set(htmlBytes.subarray(0, i), 0);
                }
                ret = concatUint8Array(ret as Uint8Array, htmlBytes.subarray(start, i));
                ret = concatUint8Array(ret as Uint8Array, lt);
                start = i + 1;
                break;
            case 62: // '>' ASCII
                if (!inited) {
                    ret = new Uint8Array(length + 128);
                    inited = true;
                    (ret as Uint8Array).set(htmlBytes.subarray(0, i), 0);
                }
                ret = concatUint8Array(ret as Uint8Array, htmlBytes.subarray(start, i));
                ret = concatUint8Array(ret as Uint8Array, gt);
                start = i + 1;
                break;
            case 34: // '"' ASCII
                if (!inited) {
                    ret = new Uint8Array(length + 128);
                    inited = true;
                    (ret as Uint8Array).set(htmlBytes.subarray(0, i), 0);
                }
                ret = concatUint8Array(ret as Uint8Array, htmlBytes.subarray(start, i));
                ret = concatUint8Array(ret as Uint8Array, quot);
                start = i + 1;
                break;
        }
    }

    if (inited) {
        ret = concatUint8Array(ret as Uint8Array, htmlBytes.subarray(start));
    }

    // 将结果 Uint8Array 转回字符串
    return inited ? new TextDecoder().decode(ret as Uint8Array) : html;
}

function concatUint8Array(arr1: Uint8Array, arr2: Uint8Array): Uint8Array {
    let result = new Uint8Array(arr1.length + arr2.length);
    result.set(arr1, 0);
    result.set(arr2, arr1.length);
    return result;
}


export async function highlightElementTextByCss(
    contentElement: HTMLElement,
    keywords: string[],
    nextMatchFocusIndex: number,
): Promise<Range> {
    if (!contentElement || !keywords) {
        return;
    }
    // If the CSS Custom Highlight API is not supported,
    // display a message and bail-out.
    if (!CSS.highlights) {
        console.log("CSS Custom Highlight API not supported.");
        return;
    }

    // Find all text nodes in the article. We'll search within
    // these text nodes.
    const treeWalker = document.createTreeWalker(
        contentElement,
        NodeFilter.SHOW_TEXT,
    );
    const allTextNodes: Node[] = [];
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
        allTextNodes.push(currentNode);
        currentNode = treeWalker.nextNode();
    }

    // Clear the HighlightRegistry to remove the
    // previous search results.
    clearCssHighlights();

    // Clean-up the search query and bail-out if
    // if it's empty.

    let allMatchRanges: Range[] = [];
    let targetElementMatchRanges: Range[] = [];

    // Iterate over all text nodes and find matches.
    allTextNodes
        .map((el: Node) => {
            return { el, text: el.textContent.toLowerCase() };
        })
        .map(({ el, text }) => {
            const indices: { index: number; length: number }[] = [];
            for (const queryStr of keywords) {
                if (!queryStr) {
                    continue;
                }
                let startPos = 0;
                while (startPos < text.length) {
                    const index = text.indexOf(
                        queryStr.toLowerCase(),
                        startPos,
                    );
                    if (index === -1) break;
                    let length = queryStr.length;
                    indices.push({ index, length });
                    startPos = index + length;
                }
            }

            indices
                .sort((a, b) => a.index - b.index)
                .map(({ index, length }) => {
                    const range = new Range();
                    range.setStart(el, index);
                    range.setEnd(el, index + length);
                    allMatchRanges.push(range);
                    // if (getNodeId(el) == targetBlockId) {
                    targetElementMatchRanges.push(range);
                    // }
                });
        });

    // Create a Highlight object for the ranges.
    allMatchRanges = allMatchRanges.flat();
    if (!allMatchRanges || allMatchRanges.length <= 0) {
        return;
    }
    let matchFocusRange: Range;
    let nextMatchIndexRemainder = null;
    if (isNumberValid(nextMatchFocusIndex) && targetElementMatchRanges.length > 0) {
        nextMatchIndexRemainder = nextMatchFocusIndex % targetElementMatchRanges.length;
    }
    for (let i = 0; i < targetElementMatchRanges.length; i++) {
        if (i == nextMatchIndexRemainder) {
            matchFocusRange = targetElementMatchRanges[i];
            break;
        }
    }


    allMatchRanges = allMatchRanges.filter(
        (obj) => obj !== matchFocusRange,
    );

    const searchResultsHighlight = new Highlight(...allMatchRanges);

    // Register the Highlight object in the registry.
    CSS.highlights.set("dual-doc-list-search-result-mark", searchResultsHighlight);

    if (matchFocusRange) {
        CSS.highlights.set(
            "dual-doc-list-search-result-focus",
            new Highlight(matchFocusRange),
        );
        return matchFocusRange;
    }

    return;
}

export function scrollByRange(matchRange: Range, position: ScrollLogicalPosition) {
    if (!matchRange) {
        return;
    }
    position = position ? position : "center";

    const matchElement =
        matchRange.commonAncestorContainer.parentElement;
    if (!matchElement) {
        return;
    }

    if (
        matchElement.clientHeight >
        document.documentElement.clientHeight
    ) {
        // 特殊情况：如果一个段落中软换行非常多，此时如果定位到匹配节点的首行，
        // 是看不到查询的文本的，需要通过 Range 的精确位置进行定位。
        const scrollingElement = findScrollingElement(matchElement);
        const contentRect = scrollingElement.getBoundingClientRect();
        let scrollTop =
            scrollingElement.scrollTop +
            matchRange.getBoundingClientRect().top -
            contentRect.top -
            contentRect.height / 2;
        scrollingElement.scrollTo({
            top: scrollTop,
            behavior: "smooth",
        });
    } else {
        matchElement.scrollIntoView({
            behavior: "smooth",
            block: position,
            inline: position,
        });
    }
}


export function clearCssHighlights() {
    CSS.highlights.delete("dual-doc-list-search-result-mark");
    CSS.highlights.delete("dual-doc-list-search-result-focus");
}

// 查找包含指定元素的最近的滚动容器
function findScrollingElement(
    element: HTMLElement,
): HTMLElement | null {
    let parentElement = element.parentElement;
    while (parentElement) {
        if (parentElement.scrollHeight > parentElement.clientHeight) {
            return parentElement; // 找到第一个具有滚动条的父级元素
        }
        parentElement = parentElement.parentElement;
    }
    return null; // 没有找到具有滚动条的父级元素
}


export function clearProtyleGutters(target: HTMLElement) {
    if (!target) {
        return;
    }
    target.querySelectorAll(".protyle-gutters").forEach((item) => {
        item.classList.add("fn__none");
        item.innerHTML = "";
    });
}


// 查找可滚动的父级元素
export function findScrollableParent(element: HTMLElement) {
    if (!element) {
        return null;
    }

    // const hasScrollableSpace = element.scrollHeight > element.clientHeight;
    const hasVisibleOverflow = getComputedStyle(element).overflowY !== 'visible';

    if (hasVisibleOverflow) {
        return element;
    }

    return findScrollableParent(element.parentElement);
}


function escapeHtml(input: string): string {
    const escapeMap: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };

    return input.replace(/[&<>"']/g, (match) => escapeMap[match]);
}


export function getRangeByElement(element: Element): Range {
    if (!element) {
        return;
    }
    let elementRange = document.createRange();
    elementRange.selectNodeContents(element);
    return elementRange;
}


export function getAttributeRecursively(element: HTMLElement | null, attributeName: string): string | null {
    // 如果元素不存在，直接返回 null
    if (!element) {
        return null;
    }
    // 尝试获取当前元素的指定属性
    const attributeValue = element.getAttribute(attributeName);

    // 如果当前元素有该属性值，返回它
    if (attributeValue) {
        return attributeValue;
    }

    // 否则，递归从父元素中查找
    return getAttributeRecursively(element.parentElement, attributeName);
}


export function findParentElementWithAttribute(element: HTMLElement, types: string[], depth: number): HTMLElement | null {
    let temp = element;
    for (let i = 0; i < depth && temp; i++) {
        const type = temp.getAttribute("data-type");
        if (types.includes(type)) {
            return temp;
        }
        temp = temp.parentElement;
    }
    return null;
}


export function convertTextToFirstElement(htmlString: string): HTMLElement {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim(); // 去除可能的空白符
    return template.content.firstElementChild as HTMLElement;
}