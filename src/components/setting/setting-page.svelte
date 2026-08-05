<script lang="ts">
    import { getSettingTabArray } from "@/models/setting-constant";
    import SettingItem from "./setting-item.svelte";
    import SettingLayout from "./SettingLayout.svelte";
    import { TabProperty } from "@/models/setting-model";
    import SettingSwitch from "./inputs/setting-switch.svelte";
    import SettingSelect from "./inputs/setting-select.svelte";
    import SettingInput from "./inputs/setting-input.svelte";
    import { SettingService } from "@/service/setting/SettingService";

    let tabArray: TabProperty[] = getSettingTabArray();
    let activeTab = tabArray[0]?.key ?? "";
    SettingService.ins.init();

    $: layoutTabs = tabArray.map((t) => ({
        key: t.key,
        label: t.name,
        icon: t.iconKey,
    }));
</script>

<div class="ddl-setting">
    <SettingLayout tabs={layoutTabs} bind:activeTab>
        {#each tabArray as tab (tab.key)}
            <div class="ddl-setting__tab" class:fn__none={activeTab !== tab.key}>
                {#each tab.props as itemProperty (itemProperty.key)}
                    <SettingItem {itemProperty}>
                        {#if itemProperty.type == "switch"}
                            <SettingSwitch {itemProperty} />
                        {:else if itemProperty.type == "select"}
                            <SettingSelect {itemProperty} />
                        {:else if itemProperty.type == "number" || itemProperty.type == "text"}
                            <SettingInput {itemProperty} />
                        {:else}
                            不能载入设置项，请检查设置代码实现。 Key: {itemProperty.key}
                            <br />
                            can't load settings, check code please. Key:
                            {itemProperty.key}
                        {/if}
                    </SettingItem>
                {/each}
            </div>
        {/each}
    </SettingLayout>
</div>

<style lang="scss">
    .ddl-setting {
        height: 100%;
    }
    .ddl-setting__tab {
        display: flex;
        flex-direction: column;
    }
</style>
