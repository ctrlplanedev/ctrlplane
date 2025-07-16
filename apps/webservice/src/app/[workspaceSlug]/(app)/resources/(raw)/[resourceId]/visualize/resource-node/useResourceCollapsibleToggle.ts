import type { Edge } from "../types";
import { useCollapsibleTree } from "../CollapsibleTreeContext";

const getDirectChildrenIds = (resourceId: string, edges: Edge[]) =>
  edges
    .filter((edge) => edge.sourceId === resourceId)
    .map((edge) => edge.targetId);

const getAllDescendantsIds = (resourceId: string, edges: Edge[]) => {
  const descendants = new Set<string>();
  const queue = [resourceId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) break;

    const childrenIds = getDirectChildrenIds(currentId, edges);
    for (const childId of childrenIds) descendants.add(childId);
    queue.push(...childrenIds);
  }

  return Array.from(descendants);
};

export const useResourceCollapsibleToggle = (resourceId: string) => {
  const {
    allEdges,
    expandedResources,
    addExpandedResourceIds,
    removeExpandedResourceIds,
  } = useCollapsibleTree();

  const expandedResourceIds = new Set(expandedResources.map((r) => r.id));
  const directChildrenIds = getDirectChildrenIds(resourceId, allEdges);
  const hiddenDirectChildrenIds = directChildrenIds.filter(
    (id) => !expandedResourceIds.has(id),
  );

  const expandResource = () => addExpandedResourceIds(hiddenDirectChildrenIds);
  const collapseResource = () =>
    removeExpandedResourceIds(getAllDescendantsIds(resourceId, allEdges));

  return {
    numDirectChildren: directChildrenIds.length,
    numHiddenDirectChildren: hiddenDirectChildrenIds.length,
    expandResource,
    collapseResource,
  };
};
