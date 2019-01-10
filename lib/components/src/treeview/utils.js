import { navigator } from 'global';
import memoize from 'memoizerific';

export const prevent = e => e.preventDefault();

export const isMacLike = () =>
  navigator && navigator.platform ? !!navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) : false;
export const controlOrMetaSymbol = () => (isMacLike() ? '⌘' : 'ctrl');
export const controlOrMetaKey = () => (isMacLike() ? 'meta' : 'control');
export const optionOrAltSymbol = () => (isMacLike() ? '⌥' : 'alt');

export const keyEventToAction = ({ keyCode, ctrlKey, shiftKey, altKey, metaKey }) => {
  if (shiftKey || metaKey || ctrlKey || altKey) {
    return false;
  }
  switch (keyCode) {
    case 18: {
      return 'ENTER';
    }
    case 32: {
      return 'SPACE';
    }
    case 38: {
      return 'UP';
    }
    case 40: {
      return 'DOWN';
    }
    case 37: {
      return 'LEFT';
    }
    case 39: {
      return 'RIGHT';
    }
    default: {
      return false;
    }
  }
};

export const createId = (id, prefix) => `${prefix}_${id}`;

export const get = ({ id, dataset }) => dataset[id];
export const getParent = ({ id, dataset }) => {
  const item = get({ id, dataset });
  if (!item || item.isRoot) {
    return undefined;
  }
  return get({ id: item.parent, dataset });
};
export const getParents = ({ id, dataset }) => {
  const parent = getParent({ id, dataset });

  if (!parent) {
    return [];
  }
  return [parent, ...getParents({ id: parent.id, dataset })];
};

export const getMains = memoize(1)(dataset =>
  Object.values(dataset)
    .filter(m => m.depth === 0)
    .sort((a, b) => {
      if (a.isRoot && b.isRoot) {
        return a.id > b.id;
      }
      if (!a.isRoot && !b.isRoot) {
        return 0;
      }
      if (a.isRoot) {
        return -1;
      }
      if (b.isRoot) {
        return 1;
      }
      return 0;
    })
);
const getMainsKeys = ({ dataset }) => getMains(dataset).map(m => m.id);

export const getPrevious = ({ id, dataset, expanded }) => {
  // STEP 1
  // find parent
  // if no previous sibling, use parent
  // unless parent is root
  //
  // STEP 2
  // find previous sibling
  // recurse into that sibling's last children that are expanded

  // debugger;
  const current = get({ id, dataset });
  const parent = getParent({ id, dataset });
  const mains = getMainsKeys({ dataset });

  const siblings = parent && parent.children ? parent.children : mains;
  const index = siblings.indexOf(current.id);

  if (index === 0) {
    if (parent && parent.isRoot) {
      return getPrevious({ id: parent.id, dataset, expanded });
    }
    if (!parent) {
      return undefined;
    }
    return parent;
  }

  let item = get({ id: siblings[index - 1], dataset });

  while (item.children && expanded[item.id]) {
    item = get({ id: item.children.slice(-1)[0], dataset });
  }

  if (item.isRoot) {
    return getPrevious({ id: item.id, dataset, expanded });
  }

  return item;
};

export const getNext = ({ id, dataset, expanded }) => {
  // STEP 1:
  // find any children if the node is expanded, first child
  //
  // STEP 2
  // iterate over parents, + fake 'root':
  // - find index of last parent as child in grandparent
  // - if child has next sibling, return
  // - if not, continue iterating
  const current = get({ id, dataset });

  if (!current) {
    return undefined;
  }

  const { children } = current;

  if (children && children.length && (expanded[current.id] || current.isRoot)) {
    return get({ id: children[0], dataset });
  }

  const mains = getMainsKeys({ dataset });

  const parents = getParents({ id, dataset }).concat([{ children: mains }]);

  const next = parents.reduce(
    (acc, item) => {
      if (acc.result) {
        return acc;
      }
      const parent = item;
      const siblings = parent && parent.children ? parent.children : mains;
      const index = siblings.indexOf(acc.child.id);

      if (siblings[index + 1]) {
        return { result: get({ id: siblings[index + 1], dataset }) };
      }
      return { child: parent };
    },
    { child: current, result: undefined }
  );

  if (next.result && next.result.isRoot) {
    return getNext({ id: next.result.id, dataset, expanded });
  }
  return next.result;
};

export const toId = (base, addition) => (base === '' ? `${addition}` : `${base}-${addition}`);
export const toFiltered = (dataset, filter) => {
  // match items on the filter
  const found = Object.entries(dataset).filter(
    ([k, v]) =>
      k.match(new RegExp(filter, 'i')) || (v.token && v.token.match(new RegExp(filter, 'i')))
  );

  // get all parents for all results
  const result = found.reduce((acc, [key, item]) => {
    const parents = getParents({ id: item.id, dataset }).reduce(
      (pacc, pitem) => ({ ...pacc, [pitem.id]: { ...pitem } }),
      {}
    );

    return { ...acc, [key]: item, ...parents };
  }, {});

  // filter the children of the found items (and their parents) so only found entries are present
  return Object.entries(result).reduce(
    (acc, [k, v]) => ({
      ...acc,
      [k]: v.children ? { ...v, children: v.children.filter(c => !!result[c]) } : v,
    }),
    {}
    // { root: { children: dataset.root.children.filter(k => result[k]) } }
  );
};