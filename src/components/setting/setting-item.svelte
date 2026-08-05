<script lang="ts">
    import { ItemProperty } from "@/models/setting-model";

    export let itemProperty: ItemProperty;
</script>

<div class="ddl-setting-item">
    <div class="ddl-setting-item__label">
        <div class="ddl-setting-item__title">{itemProperty.name}</div>
        {#if itemProperty.description}
            <div class="ddl-setting-item__desc">
                {@html itemProperty.description}
            </div>
        {/if}
    </div>
    <div class="ddl-setting-item__control">
        <slot />
    </div>
</div>

<style lang="scss">
    .ddl-setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 0;
        border-bottom: 1px solid var(--b3-border-color);
    }
    .ddl-setting-item:last-child {
        border-bottom: none;
    }
    .ddl-setting-item__label {
        min-width: 0;
    }
    .ddl-setting-item__title {
        font-size: 13px;
        font-weight: 600;
        color: var(--b3-theme-primary);
    }
    .ddl-setting-item__desc {
        font-size: 12px;
        color: var(--b3-theme-on-surface-light);
        margin-top: 3px;
        line-height: 1.5;
    }
    .ddl-setting-item__control {
        flex-shrink: 0;
    }
</style>
