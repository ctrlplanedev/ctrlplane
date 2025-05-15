import { useRouter, useSearchParams } from "next/navigation";

export const useExpandedWidget = () => {
  const router = useRouter();
  const params = useSearchParams();
  const expandedWidgetId = params.get("widgetId");
  const isEditing = params.get("isEditing") === "true";

  const setExpandedWidget = (widgetId: string, isEditing?: boolean) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.set("widgetId", widgetId);
    if (isEditing != null) urlParams.set("isEditing", isEditing.toString());
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  const clearExpandedWidget = () => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.delete("widgetId");
    urlParams.delete("isEditing");
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  const setIsEditing = (isEditing: boolean) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.set("isEditing", isEditing.toString());
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  return {
    expandedWidgetId,
    isEditing,
    setExpandedWidget,
    clearExpandedWidget,
    setIsEditing,
  };
};
