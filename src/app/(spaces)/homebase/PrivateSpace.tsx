"use client";

import React, { useEffect, useMemo, useState, lazy, useCallback } from "react";
import { useAppStore } from "@/common/data/stores/app";
import SpacePage, { SpacePageArgs } from "@/app/(spaces)/SpacePage";
import FeedModule, { FilterType } from "@/fidgets/farcaster/Feed";
import { FeedType } from "@neynar/nodejs-sdk";
import { isNil, noop } from "lodash";
import useCurrentFid from "@/common/lib/hooks/useCurrentFid";
import { useRouter } from "next/navigation";
import { useSidebarContext } from "@/common/components/organisms/Sidebar";
import { INITIAL_SPACE_CONFIG_EMPTY } from "@/constants/initialPersonSpace";
import { HOMEBASE_ID } from "@/common/data/stores/app/currentSpace";
import TabBarSkeleton from "@/common/components/organisms/TabBarSkeleton";
import SpaceLoading from "@/app/(spaces)/SpaceLoading";
import { LoginModal } from "@privy-io/react-auth";

// Lazy load the TabBar component to improve performance
const TabBar = lazy(() => import('@/common/components/organisms/TabBar'));

// Main component for the private space
function PrivateSpace({ tabName }: { tabName: string }) {
  // Destructure and retrieve various state and actions from the app store
  const {
    tabConfigs,
    homebaseConfig,
    loadTab,
    saveTab,
    commitTab,
    resetTab,
    saveConfig,
    loadFeedConfig,
    commitConfig,
    resetConfig,
    setCurrentSpaceId,
    setCurrentTabName,
    loadTabNames,
    tabOrdering,
    getIsLoggedIn,
    loadTabOrder,
    updateTabOrder,
    createTab,
    deleteTab,
    renameTab,
    commitTabOrder,
    setModalOpen,
  } = useAppStore((state) => ({
    tabConfigs: state.homebase.tabs,
    homebaseConfig: state.homebase.homebaseConfig,
    loadTab: state.homebase.loadHomebaseTab,
    saveTab: state.homebase.saveHomebaseTabConfig,
    commitTab: state.homebase.commitHomebaseTabToDatabase,
    resetTab: state.homebase.resetHomebaseTabConfig,
    saveConfig: state.homebase.saveHomebaseConfig,
    loadFeedConfig: state.homebase.loadHomebase,
    commitConfig: state.homebase.commitHomebaseToDatabase,
    resetConfig: state.homebase.resetHomebaseConfig,
    getIsLoggedIn: state.getIsAccountReady,
    setCurrentSpaceId: state.currentSpace.setCurrentSpaceId,
    setCurrentTabName: state.currentSpace.setCurrentTabName,
    tabOrdering: state.homebase.tabOrdering,
    loadTabNames: state.homebase.loadTabNames,
    loadTabOrder: state.homebase.loadTabOrdering,
    updateTabOrder: state.homebase.updateTabOrdering,
    commitTabOrder: state.homebase.commitTabOrderingToDatabase,
    createTab: state.homebase.createTab,
    deleteTab: state.homebase.deleteTab,
    renameTab: state.homebase.renameTab,
    setModalOpen: state.setup.setModalOpen,
  }));

  const router = useRouter(); // Hook for navigation
  const isLoggedIn = getIsLoggedIn(); // Check if the user is logged in
  const currentFid = useCurrentFid(); // Get the current FID
  const isFeedTab = tabName === "Feed"; // Check if the current tab is the "Feed" tab

  const { editMode } = useSidebarContext(); // Get the edit mode status from the sidebar context

  // Effect to handle login modal when user is not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      // Open the login modal if user is not logged in
      setModalOpen(true);
    }
  }, [isLoggedIn, setModalOpen]);

  // Effect to set the current space and tab name, and load the tab configuration
  useEffect(() => {
    setCurrentSpaceId(HOMEBASE_ID);
    setCurrentTabName(tabName);
    if (!isNil(tabName)) {
      loadTabConfig();
    }
  }, []);

  // Function to load the configuration for the current tab
  async function loadTabConfig() {
    await loadTabNames();

    if (tabOrdering.local.length === 0) {
      await loadTabOrder();
    }

    if (isFeedTab) {
      await loadFeedConfig();
    } else {
      await loadTab(tabName);
    }
  }

  // Function to switch to a different tab
  function switchTabTo(newTabName: string) {
    commitConfigHandler();

    if (newTabName === "Feed") {
      router.push(`/homebase`);
    } else {
      router.push(`/homebase/${newTabName}`);
    }
  }

  // Function to get the URL for a given tab
  function getSpacePageUrl(tabName: string) {
    if (tabName === "Feed") {
      return `/homebase`;
    }
    return `/homebase/${tabName}`;
  }

  // Handler to reset the configuration for the current tab
  const resetConfigHandler = async () => {
    if (isFeedTab) {
      return resetConfig();
    } else {
      return resetTab(tabName);
    }
  };

  // Handler to commit the configuration for the current tab
  const commitConfigHandler = async () => {
    if (isFeedTab) {
      await commitConfig();
    } else {
      await commitTab(tabName);
    }
    
    await commitTabOrder();
    for (const tab of tabOrdering.local) {
      if (tab !== tabName && tab !== "Feed") {
        await commitTab(tab);
      }
    }
  };

  // Handler to save the configuration for the current tab
  const saveConfigHandler = async (configToSave) => {
    if (isFeedTab) {
      await saveConfig(configToSave);
    } else {
      await saveTab(tabName, configToSave);
    }
    return commitConfigHandler();
  };

  // Memoize the TabBar component to prevent unnecessary re-renders
  const tabBar = useMemo(() => (
    <TabBar
      getSpacePageUrl={getSpacePageUrl}
      inHomebase={true}
      currentTab={tabName}
      tabList={tabOrdering.local}
      switchTabTo={switchTabTo}
      updateTabOrder={updateTabOrder}
      inEditMode={editMode}
      deleteTab={deleteTab}
      createTab={createTab}
      renameTab={renameTab}
      commitTabOrder={commitTabOrder}
      commitTab={commitTab}
    />
  ), [tabName, tabOrdering.local, editMode]);

  // Define the arguments for the SpacePage component
  const args: SpacePageArgs = useMemo(() => ({
    config: (() => {
      const { timestamp, ...restConfig } = {
        ...((isFeedTab 
            ? homebaseConfig 
            : tabConfigs[tabName]?.config)
            ?? INITIAL_SPACE_CONFIG_EMPTY),
        isEditable: true,
      };
      return restConfig;
    })(),
    saveConfig: saveConfigHandler,
    commitConfig: commitConfigHandler,
    resetConfig: resetConfigHandler,
    tabBar: tabBar,
    feed: isFeedTab && currentFid ? (
      <FeedModule.fidget
        settings={{
          feedType: FeedType.Following,
          users: "",
          filterType: FilterType.Users,
          selectPlatform: { name: "Farcaster", icon: "/images/farcaster.jpeg" },
          Xhandle: "",
          style: "",
          fontFamily: "var(--user-theme-font)",
          fontColor: "var(--user-theme-font-color)" as any,
        }}
        saveData={async () => noop()}
        data={{}}
      />
    ) : undefined,
  }), [
    tabName,
    isFeedTab 
      ? homebaseConfig 
      : tabConfigs[tabName]?.config,
    editMode
  ]);

  // If not logged in, show a loading state with the login modal
  if (!isLoggedIn) {
    return (
      <div className="user-theme-background w-full h-full relative flex-col">
        <div className="w-full transition-all duration-100 ease-out">
          <div className="flex flex-col h-full">
            <TabBarSkeleton />
            <div className="flex h-full">
              <div className={"grow"}>
                <SpaceLoading hasProfile={false} hasFeed={isFeedTab} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render the SpacePage component with the defined arguments
  return (
    <SpacePage key={tabName} {...args} />
  );
}

export default PrivateSpace; 