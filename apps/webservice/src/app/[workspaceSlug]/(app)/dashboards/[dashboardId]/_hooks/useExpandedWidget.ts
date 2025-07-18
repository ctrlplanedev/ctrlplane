import { useRouter, useSearchParams } from "next/navigation";

const EXPANDED_WIDGET_ID_PARAM = "expandedWidgetId";

export const useExpandedWidget = () => {
  const router = useRouter();
  const params = useSearchParams();
  const expandedWidgetId = params.get(EXPANDED_WIDGET_ID_PARAM);

  const setExpandedWidget = (widgetId: string) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.set(EXPANDED_WIDGET_ID_PARAM, widgetId);
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  const clearExpandedWidget = () => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.delete(EXPANDED_WIDGET_ID_PARAM);
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  return {
    expandedWidgetId,
    setExpandedWidget,
    clearExpandedWidget,
  };
};
