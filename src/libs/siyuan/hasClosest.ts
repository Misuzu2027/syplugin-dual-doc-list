export const hasClosestByTag = (element: Node, nodeName: string) => {
    if (!element) {
        return false;
    }
    if (element.nodeType === 3) {
        element = element.parentElement;
    }
    let e = element as HTMLElement;
    let isClosest = false;
    while (e && !isClosest && !e.classList.contains("b3-typography")) {
        if (e.nodeName.indexOf(nodeName) === 0) {
            isClosest = true;
        } else {
            e = e.parentElement;
        }
    }
    return isClosest && e;
};

export const hasTopClosestByTag = (element: Node, nodeName: string) => {
    let closest = hasClosestByTag(element, nodeName);
    let parentClosest: boolean | HTMLElement = false;
    let findTop = false;
    while (closest && !closest.classList.contains("protyle-wysiwyg") && !findTop) {
        parentClosest = hasClosestByTag(closest.parentElement, nodeName);
        if (parentClosest) {
            closest = parentClosest;
        } else {
            findTop = true;
        }
    }
    return closest || false;
};

export const hasClosestByAttribute = (element: Node, attr: string, value: string | null, top = false) => {
    if (!element) {
        return false;
    }
    if (element.nodeType === 3) {
        element = element.parentElement;
    }
    let e = element as HTMLElement;
    let isClosest = false;
    // 当 top 为 true 时，遍历到 BODY 停止。 否则遍历到 protyle-wysiwyg 结束。
    while (e && !isClosest && (top ? e.tagName !== "BODY" : !e.classList.contains("protyle-wysiwyg"))) {
        if (typeof value === "string" && e.getAttribute(attr)?.split(" ").includes(value)) {
            isClosest = true;
        } else if (typeof value !== "string" && e.hasAttribute(attr)) {
            isClosest = true;
        } else {
            e = e.parentElement;
        }
    }
    return isClosest && e;
};


export const hasClosestBySelector = (
    element: Node,
    selector: string,
    top = false
): HTMLElement | false => {
    if (!element) {
        return false;
    }

    if (element.nodeType === 3) { // 文本节点
        element = element.parentElement;
    }

    let e = element as HTMLElement;
    let isClosest = false;
    // 当 top 为 true 时，遍历到 BODY 停止。 否则遍历到 protyle-wysiwyg 结束。
    while (e && !isClosest && (top ? e.tagName !== "BODY" : !e.classList.contains("protyle-wysiwyg"))) {
        if (e.matches(selector)) {
            isClosest = true;
        } else {
            e = e.parentElement;
        }
    }

    return isClosest ? e : false;
};
