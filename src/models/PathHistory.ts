import { equalObjectJson } from "@/utils/object-util";

export interface INotebookPath {
    notebookId: string;
    docId: string;
    docPath: string;
}
export class PathHistory {
    private history: INotebookPath[] = []; // 用于保存路径的栈
    private forwardHistory: INotebookPath[] = []; // 用于保存前进路径的栈
    private maxHistorySize: number = 10; // 最大历史路径数量

    // 切换路径时，将新路径压入栈，并清空前进栈（因为新路径切换后无法前进）
    switchPath(newPath: INotebookPath) {
        let lastPath = this.history[this.history.length - 1];
        if (equalObjectJson(lastPath, newPath)) {
            return;
        }
        this.history.push(newPath);
        this.forwardHistory = []; // 每次切换路径，前进路径清空
        // 如果历史路径数量超过限制，移除最旧的路径
        if (this.history.length > this.maxHistorySize) {
            this.history.shift(); // 移除最旧的路径
        }
    }

    // 回退操作，返回上上个路径，并删除两个路径，保存到前进栈
    back(): INotebookPath | null {
        if (this.history.length < 2) {
            return null; // 如果路径历史不足2个，不能回退
        }

        // 将最近1个路径存入前进栈
        this.forwardHistory.push(this.history.pop());
        // let backPath = this.history.pop() 
        // this.forwardHistory.push(backPath);

        return this.history[this.history.length - 1]; // 返回上个路径
    }

    // 前进操作，从前进栈中恢复路径
    forward(): INotebookPath | null {
        if (this.forwardHistory.length < 1) {
            return null; // 如果前进栈不足1个，无法前进
        }

        // 将前进栈中的路径重新加入到历史栈
        let path = this.forwardHistory.pop();
        this.history.push(path);
        // this.history.push(this.forwardHistory.pop() as string);

        return path; // 返回前进后的路径
    }

    // 获取当前路径
    currentPath(): INotebookPath | null {
        if (this.history.length === 0) {
            return null; // 栈为空时没有路径
        }
        return this.history[this.history.length - 1];
    }

    // 查看所有路径历史
    getHistory(): INotebookPath[] {
        return [...this.history];
    }

    getHistoryLength(): number {
        return this.history.length;
    }
}
