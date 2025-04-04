"use client";
import React, { ReactNode, useEffect, useMemo, Suspense } from "react";
import {
  FidgetConfig,
  FidgetInstanceData,
  FidgetSettings,
  LayoutFidgetConfig,
  LayoutFidgetDetails,
  LayoutFidgetSavableConfig as LayoutFidgetSaveableConfig,
} from "@/common/fidgets";
import { UserTheme } from "@/common/lib/theme";
import CustomHTMLBackground from "@/common/components/molecules/CustomHTMLBackground";
import { isNil, isUndefined } from "lodash";
import InfoToast from "@/common/components/organisms/InfoBanner";
import TabBarSkeleton from "@/common/components/organisms/TabBarSkeleton";
import SpaceLoading from "./SpaceLoading";
// Import the LayoutFidgets directly
import { LayoutFidgets } from "@/fidgets";

export type SpaceFidgetConfig = {
  instanceConfig: FidgetConfig<FidgetSettings>;
  fidgetType: string;
  id: string;
};

export type SpaceConfig = {
  fidgetInstanceDatums: {
    [key: string]: FidgetInstanceData;
  };
  layoutID: string;
  layoutDetails: LayoutFidgetDetails<LayoutFidgetConfig<any>>;
  isEditable: boolean;
  fidgetTrayContents: FidgetInstanceData[];
  theme: UserTheme;
  timestamp?: string;
};

export type SpaceConfigSaveDetails = Partial<
  Omit<SpaceConfig, "layoutDetails">
> & {
  layoutDetails?: Partial<LayoutFidgetDetails<LayoutFidgetConfig<any>>>;
};

type SpaceArgs = {
  config: SpaceConfig;
  saveConfig: (config: SpaceConfigSaveDetails) => Promise<void>;
  commitConfig: () => Promise<void>;
  resetConfig: () => Promise<void>;
  tabBar: ReactNode;
  profile?: ReactNode;
  feed?: ReactNode;
  setEditMode: (v: boolean) => void;
  editMode: boolean;
  setSidebarEditable: (v: boolean) => void;
  portalRef: React.RefObject<HTMLDivElement>;
};

export default function Space({
  config,
  saveConfig,
  commitConfig,
  resetConfig,
  tabBar,
  profile,
  feed,
  setEditMode,
  editMode,
  setSidebarEditable,
  portalRef,
}: SpaceArgs) {
  useEffect(() => {
    setSidebarEditable(config.isEditable);
  }, [config.isEditable]);

  function saveExitEditMode() {
    commitConfig();
    setEditMode(false);
  }

  function cancelExitEditMode() {
    resetConfig();
    setEditMode(false);
  }

  async function saveLocalConfig({
    theme,
    layoutConfig,
    fidgetInstanceDatums,
    fidgetTrayContents,
  }: Partial<LayoutFidgetSaveableConfig<LayoutFidgetConfig<any>>>) {
    return saveConfig({
      layoutDetails: layoutConfig
        ? {
            layoutConfig,
          }
        : undefined,
      theme,
      fidgetInstanceDatums,
      fidgetTrayContents,
    });
  }

  // Memoize the LayoutFidget component selection
  const LayoutFidget = useMemo(() => {
    return LayoutFidgets[config?.layoutDetails?.layoutFidget || "grid"] || LayoutFidgets.grid;
  }, [config?.layoutDetails?.layoutFidget]);

  // Memoize the layoutConfig to prevent unnecessary re-renders
  const layoutConfig = useMemo(() => {
    return config?.layoutDetails?.layoutConfig ?? {
      layout: [],
      layoutFidget: "grid",
    };
  }, [config?.layoutDetails?.layoutConfig]);

  // Memoize the LayoutFidget render props that don't change during fidget movement
  const layoutFidgetProps = useMemo(() => {
    return {
      theme: config.theme,
      fidgetTrayContents: config.fidgetTrayContents,
      inEditMode: editMode,
      saveExitEditMode: saveExitEditMode,
      cancelExitEditMode: cancelExitEditMode,
      portalRef: portalRef,
      saveConfig: saveLocalConfig,
      hasProfile: !isNil(profile),
      hasFeed: !isNil(feed),
    };
  }, [
    config.theme, 
    config.fidgetTrayContents, 
    editMode, 
    portalRef, 
    profile, 
    feed
  ]);

  return (
    <div className="user-theme-background w-full h-full relative flex-col">
      <CustomHTMLBackground html={config.theme?.properties.backgroundHTML} />
      <div className="w-full transition-all duration-100 ease-out">
        <div className="flex flex-col h-full">
          <div style={{ position: "fixed", zIndex: 9999 }}>
            <InfoToast />
          </div>
          {!isUndefined(profile) ? (
            <div className="z-50 bg-white h-40">{profile}</div>
          ) : null}
          <Suspense fallback={<TabBarSkeleton />}>
            {tabBar}
          </Suspense>
          <div className="flex h-full">
            {!isUndefined(feed) ? (
              <div className="w-6/12 h-[calc(100vh-64px)]">{feed}</div>
            ) : null}
            <div className={"grow"}>
              <Suspense fallback={<SpaceLoading hasProfile={!isNil(profile)} hasFeed={!isNil(feed)} />}>
                <LayoutFidget
                  layoutConfig={{ ...layoutConfig }}
                  fidgetInstanceDatums={config.fidgetInstanceDatums}
                  theme={config.theme}
                  fidgetTrayContents={config.fidgetTrayContents}
                  inEditMode={editMode}
                  saveExitEditMode={saveExitEditMode}
                  cancelExitEditMode={cancelExitEditMode}
                  portalRef={portalRef}
                  saveConfig={saveLocalConfig}
                  hasProfile={!isNil(profile)}
                  hasFeed={!isNil(feed)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
