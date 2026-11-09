export {};

declare module "siyuan" {
    export function openDocTreeMenu(options: {
        position?: { x: number; y: number; w?: number; h?: number };
        items: { notebookId: string; id?: string }[];
    }): Promise<boolean>;
}
