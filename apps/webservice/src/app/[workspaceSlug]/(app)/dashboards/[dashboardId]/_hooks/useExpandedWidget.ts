import { useRouter, useSearchParams } from "next/navigation";

const WIDGET_ID_PARAM = "widgetId";
const IS_EDITING_PARAM = "isEditing";

export const useExpandedWidget = () => {
  const router = useRouter();
  const params = useSearchParams();
  const expandedWidgetId = params.get(WIDGET_ID_PARAM);
  const isEditing = params.get(IS_EDITING_PARAM) === "true";

  const setExpandedWidget = (widgetId: string, isEditing?: boolean) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.set(WIDGET_ID_PARAM, widgetId);
    if (isEditing != null)
      urlParams.set(IS_EDITING_PARAM, isEditing.toString());
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  const clearExpandedWidget = () => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.delete(WIDGET_ID_PARAM);
    urlParams.delete(IS_EDITING_PARAM);
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  const setIsEditing = (isEditing: boolean) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.set(IS_EDITING_PARAM, isEditing.toString());
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
