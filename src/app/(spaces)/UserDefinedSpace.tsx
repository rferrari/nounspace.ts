"use client";
import { indexOf, isNil, mapValues, noop, first } from "lodash";
import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useAuthenticatorManager } from "@/authenticators/AuthenticatorManager";
import { useAppStore } from "@/common/data/stores/app";
import createIntialPersonSpaceConfigForFid from "@/constants/initialPersonSpace";
import { SpaceConfigSaveDetails } from "./Space";
import Profile from "@/fidgets/ui/profile";
import TabBar from "@/common/components/organisms/TabBar";
import SpacePage from "./SpacePage";
import { useLoadFarcasterUser } from "@/common/data/queries/farcaster";
import { useSidebarContext } from "@/common/components/organisms/Sidebar";
import { useRouter } from "next/navigation";

const FARCASTER_NOUNSPACE_AUTHENTICATOR_NAME = "farcaster:nounspace";

export default function UserDefinedSpace({
  spaceId: providedSpaceId,
  tabName: providedTabName,
  fid,
}: {
  spaceId: string | null;
  tabName: string;
  fid: number;
}) {
  const router = useRouter();
  const {
    lastUpdatedAt: authManagerLastUpdatedAt,
    getInitializedAuthenticators: authManagerGetInitializedAuthenticators,
    callMethod: authManagerCallMethod,
  } = useAuthenticatorManager();
  const {
    editableSpaces,
    localSpaces,
    remoteSpaces,
    loadSpaceTab,
    saveLocalSpaceTab,
    commitSpaceTab,
    registerSpace,
    getCurrentSpaceConfig,
    setCurrentSpaceId,
    setCurrentTabName,
    loadSpaceTabOrder,
    updateSpaceTabOrder,
    commitSpaceTabOrder,
    createSpaceTab,
    deleteSpaceTab,
  } = useAppStore((state) => ({
    editableSpaces: state.space.editableSpaces,
    localSpaces: state.space.localSpaces,
    remoteSpaces: state.space.remoteSpaces,
    currentSpaceId: state.currentSpace.currentSpaceId,
    setCurrentSpaceId: state.currentSpace.setCurrentSpaceId,
    setCurrentTabName: state.currentSpace.setCurrentTabName,

    // TODO: update these two to work with tabs?
    registerSpace: state.space.registerSpaceFid,
    getCurrentSpaceConfig: state.currentSpace.getCurrentSpaceConfig,

    loadSpaceTab: state.space.loadSpaceTab,
    createSpaceTab: state.space.createSpaceTab,
    deleteSpaceTab: state.space.deleteSpaceTab,
    saveLocalSpaceTab: state.space.saveLocalSpaceTab,
    commitSpaceTab: state.space.commitSpaceTabToDatabase,

    loadSpaceTabOrder: state.space.loadSpaceTabOrder,
    updateSpaceTabOrder: state.space.updateLocalSpaceOrder,
    commitSpaceTabOrder: state.space.commitSpaceOrderToDatabase,
  }));
  const [loading, setLoading] = useState(!isNil(providedSpaceId));
  const [spaceId, setSpaceId] = useState(providedSpaceId);

  // Loads and sets up the user's space tab when providedSpaceId or providedTabName changes
  useEffect(() => {
    setCurrentSpaceId(providedSpaceId);
    setCurrentTabName(providedTabName);
    if (!isNil(providedSpaceId)) {
      setLoading(true);
      // First, load the space tab order
      loadSpaceTabOrder(providedSpaceId)
        .then(() => {
          // After loading the tab order, load the specific tab
          return loadSpaceTab(providedSpaceId, providedTabName);
        })
        .then(() => {
          setSpaceId(providedSpaceId);
          setLoading(false);
          // Load remaining tabs after the initial one has finished
          return loadRemainingTabs(providedSpaceId);
        })
        .catch((error) => {
          console.error("Error loading space:", error);
          setLoading(false);
        });
    }
  }, [providedSpaceId, providedTabName]);

  // Function to load remaining tabs
  const loadRemainingTabs = useCallback(
    async (spaceId: string) => {
      const tabOrder = localSpaces[spaceId]?.order || [];
      for (const tabName of tabOrder) {
        if (tabName !== providedTabName) {
          await loadSpaceTab(spaceId, tabName);
        }
      }
    },
    [localSpaces, providedTabName, loadSpaceTab],
  );

  const [isSignedIntoFarcaster, setIsSignedIntoFarcaster] = useState(false);
  useEffect(() => {
    authManagerGetInitializedAuthenticators().then((authNames) => {
      setIsSignedIntoFarcaster(
        indexOf(authNames, FARCASTER_NOUNSPACE_AUTHENTICATOR_NAME) > -1,
      );
    });
  }, [authManagerLastUpdatedAt]);

  const [currentUserFid, setCurrentUserFid] = useState<number | null>(null);

  useEffect(() => {
    if (!isSignedIntoFarcaster) return;
    authManagerCallMethod({
      requestingFidgetId: "root",
      authenticatorId: FARCASTER_NOUNSPACE_AUTHENTICATOR_NAME,
      methodName: "getAccountFid",
      isLookup: true,
    }).then((authManagerResp) => {
      if (authManagerResp.result === "success") {
        setCurrentUserFid(authManagerResp.value as number);
      }
    });
  }, [isSignedIntoFarcaster, authManagerLastUpdatedAt]);

  const isEditable = useMemo(() => {
    return (
      (isNil(spaceId) && fid === currentUserFid) ||
      (!isNil(spaceId) && spaceId in editableSpaces)
    );
  }, [editableSpaces, currentUserFid]);

  const INITIAL_PERSONAL_SPACE_CONFIG = useMemo(
    () => createIntialPersonSpaceConfigForFid(fid),
    [fid],
  );

  const currentConfig = getCurrentSpaceConfig();

  const config = {
    ...(currentConfig?.tabs[providedTabName]
      ? currentConfig.tabs[providedTabName]
      : INITIAL_PERSONAL_SPACE_CONFIG),
    isEditable,
  };

  const memoizedConfig = useMemo(() => {
    const { timestamp, ...restConfig } = config;
    return restConfig;
  }, [
    config.fidgetInstanceDatums,
    config.layoutID,
    config.layoutDetails,
    config.fidgetTrayContents,
    config.theme,
  ]);

  // Creates a new "Profile" space for the user when they're eligible to edit but don't have an existing space ID.
  // This ensures that new users or users without a space get a default profile space created for them.
  useEffect(() => {
    if (isEditable && isNil(spaceId) && !isNil(currentUserFid)) {
      registerSpace(currentUserFid, "Profile").then((newSpaceId) => {
        if (newSpaceId) {
          setSpaceId(newSpaceId);
          setCurrentSpaceId(newSpaceId);
          setCurrentTabName("Profile");
        }
      });
    }
  }, [isEditable, spaceId, currentUserFid]);

  const saveConfig = useCallback(
    async (spaceConfig: SpaceConfigSaveDetails) => {
      if (isNil(spaceId)) {
        throw new Error("Cannot save config until space is registered");
      }
      const saveableConfig = {
        ...spaceConfig,
        fidgetInstanceDatums: mapValues(
          spaceConfig.fidgetInstanceDatums,
          (datum) => ({
            ...datum,
            config: {
              settings: datum.config.settings,
              editable: datum.config.editable,
            },
          }),
        ),
        isPrivate: false,
      };
      // Save the configuration locally
      return saveLocalSpaceTab(spaceId, providedTabName, saveableConfig);
    },
    [spaceId, providedTabName],
  );

  const commitConfig = useCallback(async () => {
    if (isNil(spaceId)) return;
    commitSpaceTab(spaceId, providedTabName);
  }, [spaceId, providedTabName]);

  // Resets the configuration of a space tab.
  // If no remote configuration exists, it sets the tab to the initial personal space config.
  // Otherwise, it restores the tab to its last saved remote state.
  const resetConfig = useCallback(async () => {
    if (isNil(spaceId)) return;
    if (isNil(remoteSpaces[spaceId])) {
      saveLocalSpaceTab(spaceId, providedTabName, {
        ...INITIAL_PERSONAL_SPACE_CONFIG,
        isPrivate: false,
      });
    } else {
      saveLocalSpaceTab(
        spaceId,
        providedTabName,
        remoteSpaces[spaceId].tabs[providedTabName],
      );
    }
  }, [spaceId, INITIAL_PERSONAL_SPACE_CONFIG, remoteSpaces, providedTabName]);

  const profile = (
    <Profile.fidget
      settings={{ fid }}
      saveData={async () => noop()}
      data={{}}
    />
  );

  const { data } = useLoadFarcasterUser(fid);
  const user = useMemo(() => first(data?.users), [data]);
  const username = useMemo(() => user?.username, [user]);

  function switchTabTo(tabName: string) {
    spaceId && saveLocalSpaceTab(spaceId, providedTabName, config);
    router.push(`/s/${username}/${tabName}`);
  }

  function getSpacePageUrl(tabName: string) {
    return `/s/${username}/${tabName}`;
  }

  const { editMode } = useSidebarContext();

  const tabBar = (
    <TabBar
      inHomebase={false}
      currentTab={providedTabName}
      tabList={spaceId ? localSpaces[spaceId]?.order : ["Profile"]}
      switchTabTo={switchTabTo}
      updateTabOrder={async (newOrder) => {
        return spaceId ? updateSpaceTabOrder(spaceId, newOrder) : undefined;
      }}
      inEditMode={editMode}
      deleteTab={async (tabName) => {
        return spaceId ? deleteSpaceTab(spaceId, tabName) : undefined;
      }}
      createTab={async (tabName) => {
        return spaceId ? createSpaceTab(spaceId, tabName) : undefined;
      }}
      renameTab={async (oldName, newName) => {
        return spaceId
          ? saveLocalSpaceTab(spaceId, oldName, config, newName)
          : undefined;
      }}
      commitTab={async (tabName) => {
        return spaceId ? commitSpaceTab(spaceId, tabName) : undefined;
      }}
      commitTabOrder={async () => {
        return spaceId ? commitSpaceTabOrder(spaceId) : undefined;
      }}
      getSpacePageUrl={getSpacePageUrl}
    />
  );

  return (
    <SpacePage
      key={spaceId + providedTabName}
      config={memoizedConfig}
      saveConfig={saveConfig}
      commitConfig={commitConfig}
      resetConfig={resetConfig}
      profile={profile}
      tabBar={tabBar}
      loading={loading}
    />
  );
}