<script lang="ts">
    import { EnvConfig } from "@/config/EnvConfig";
    import { onDestroy, onMount } from "svelte";
    import DocListSvelte from "@/components/doc-list/doc-list.svelte";
    import { isElementHidden } from "@/utils/siyuan-util";
    import { clearCssHighlights } from "@/utils/html-util";

    let isMobile = false;
    let hiddenDock: boolean;

    let rootElement: HTMLElement;
    let docListSvelte: DocListSvelte;

    onMount(async () => {
        init();
    });
    onDestroy(() => {
        docListSvelte.$destroy();
    });

    export function restView() {
        hiddenDock = isElementHidden(rootElement);
        if (hiddenDock) {
            // 隐藏侧边栏，清空高亮
            clearCssHighlights();
        }
    }

    function init() {
        isMobile = EnvConfig.ins.isMobile;
    }

    export async function switchPath(
        notebookId: string,
        docId: string,
        docPath: string,
    ) {
        if (hiddenDock) {
            return;
        }
        if (docListSvelte) {
            docListSvelte.switchPath(notebookId, docId, docPath);
        }
    }
</script>

{#if isMobile}
    <!-- <div class="toolbar toolbar--border toolbar--dark">
        <svg class="toolbar__icon"
            ><use xlink:href="#BacklinkPanelFilter"></use></svg
        >
        <div class="toolbar__text">{EnvConfig.ins.i18n.flatDocumentTree}</div>
    </div> -->
    <div class="" bind:this={rootElement}>
        <DocListSvelte bind:this={docListSvelte} />
    </div>
{:else}
    <div
        class="fn__flex-column misuzu2027__doc-list"
        bind:this={rootElement}
        style="height: 100%; "
    >
        <DocListSvelte bind:this={docListSvelte} />
    </div>
{/if}
