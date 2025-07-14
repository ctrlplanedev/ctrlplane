import { useRouter, useSearchParams } from "next/navigation";

const EDITING_WIDGET_ID_PARAM = "editingWidgetId";

export const useEditingWidget = () => {
  const router = useRouter();
  const params = useSearchParams();
  const editingWidgetId = params.get(EDITING_WIDGET_ID_PARAM);

  const setEditingWidget = (widgetId: string) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.set(EDITING_WIDGET_ID_PARAM, widgetId);
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  const clearEditingWidget = () => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    urlParams.delete(EDITING_WIDGET_ID_PARAM);
    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  return {
    editingWidgetId,
    setEditingWidget,
    clearEditingWidget,
  };
};
