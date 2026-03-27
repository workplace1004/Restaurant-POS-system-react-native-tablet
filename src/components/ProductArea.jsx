import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLanguage } from '../contexts/LanguageContext';

export function ProductArea({
  products,
  selectedCategoryId,
  categories,
  onSelectCategory,
  onAddProduct,
  currentOrderId,
  fetchSubproductsForProduct,
  positioningLayoutByCategory,
  positioningColorByCategory,
  appendSubproductNoteToItem
}) {
  const { t } = useLanguage();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const clamp = useCallback((value, min, max) => Math.min(max, Math.max(min, value)), []);
  const GRID_COLS = 6;
  const GRID_ROWS = 8;
  const GRID_GAP = 2;
  const [productAreaHeight, setProductAreaHeight] = useState(0);
  const [page, setPage] = useState(0);
  const [subPage, setSubPage] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState(null);
  const [subproducts, setSubproducts] = useState([]);
  const [loadingSubproducts, setLoadingSubproducts] = useState(false);
  const [showSubproductModal, setShowSubproductModal] = useState(false);
  const [productPressLocked, setProductPressLocked] = useState(false);
  const [addedSubproductIds, setAddedSubproductIds] = useState(() => new Set());
  const subproductsRequestIdRef = useRef(0);
  const productPressLockRef = useRef(false);
  const subproductsCacheRef = useRef(new Map());
  const SUBPRODUCTS_CACHE_TTL_MS = 60 * 1000;
  const getSubproductExtra = useCallback(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_subproduct_extra') : null;
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, []);
  const hydrateSubproducts = useCallback((list) => {
    const extraMap = getSubproductExtra();
    return (Array.isArray(list) ? list : []).map((sp) => ({
      ...sp,
      kioskPicture: extraMap?.[sp.id]?.kioskPicture || ''
    }));
  }, [getSubproductExtra]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const layoutForCategory = Array.isArray(positioningLayoutByCategory?.[selectedCategoryId])
    ? positioningLayoutByCategory[selectedCategoryId]
    : null;
  const colorForCategory = positioningColorByCategory?.[selectedCategoryId] || {};
  const PAGE_SIZE = 48; // 6 x 8, same as positioning modal
  const totalPages = Math.max(1, Math.ceil((layoutForCategory?.length || PAGE_SIZE) / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageCells = Array.from({ length: PAGE_SIZE }, (_, i) => layoutForCategory?.[pageStart + i] || null);

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));
  const SUBPRODUCTS_PER_PAGE = 5;
  const subTotalPages = Math.max(1, Math.ceil(subproducts.length / SUBPRODUCTS_PER_PAGE));
  const paginatedSubproducts = subproducts.slice(
    subPage * SUBPRODUCTS_PER_PAGE,
    subPage * SUBPRODUCTS_PER_PAGE + SUBPRODUCTS_PER_PAGE
  );
  const goSubPrev = () => setSubPage((p) => Math.max(0, p - 1));
  const goSubNext = () => setSubPage((p) => Math.min(subTotalPages - 1, p + 1));

  useEffect(() => {
    // Category switch should always clear selected product and subproducts panel.
    subproductsRequestIdRef.current += 1;
    setSelectedProduct(null);
    setSelectedOrderItemId(null);
    setSubproducts([]);
    setShowSubproductModal(false);
    setAddedSubproductIds(new Set());
    setLoadingSubproducts(false);
    productPressLockRef.current = false;
    setProductPressLocked(false);
    setPage(0);
    setSubPage(0);
  }, [selectedCategoryId]);

  useEffect(() => {
    setPage(0);
  }, [selectedCategoryId, layoutForCategory?.length]);

  useEffect(() => {
    setSubPage(0);
  }, [selectedProduct?.id, subproducts.length]);

  const handleProductPress = useCallback(
    async (product) => {
      if (productPressLockRef.current) return;
      productPressLockRef.current = true;
      setProductPressLocked(true);

      if (!fetchSubproductsForProduct) {
        try {
          await onAddProduct(product);
        } finally {
          productPressLockRef.current = false;
          setProductPressLocked(false);
        }
        return;
      }
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const runWithRetry = async (runner, retries = 1) => {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          try {
            return await runner();
          } catch (error) {
            lastError = error;
            if (attempt < retries) await wait(120);
          }
        }
        throw lastError;
      };

      setSelectedProduct(product);
      setSelectedOrderItemId(null);
      const now = Date.now();
      const cached = subproductsCacheRef.current.get(product.id);
      const hasFreshCache = !!(cached && Array.isArray(cached.list) && (now - cached.at) < SUBPRODUCTS_CACHE_TTL_MS);
      const cachedList = hasFreshCache ? cached.list : [];
      setSubproducts(hydrateSubproducts(cachedList));
      setAddedSubproductIds(new Set());
      // Open immediately only when we already know this product has subproducts.
      // Prevents wrong "open then close" flicker for products without subproducts.
      setShowSubproductModal(cachedList.length > 0);
      setLoadingSubproducts(true);
      const requestId = subproductsRequestIdRef.current + 1;
      subproductsRequestIdRef.current = requestId;
      try {
        // Run both requests together so the subproduct modal can appear faster.
        const [createdItemId, data] = await Promise.all([
          runWithRetry(() => onAddProduct(product), 1),
          runWithRetry(() => fetchSubproductsForProduct(product.id), 1)
        ]);
        if (requestId !== subproductsRequestIdRef.current) return;
        setSelectedOrderItemId(createdItemId || null);
        const list = Array.isArray(data) ? data : [];
        subproductsCacheRef.current.set(product.id, { at: Date.now(), list });
        setSubproducts(hydrateSubproducts(list));
        if (list.length > 0) {
          setShowSubproductModal(true);
        } else {
          setShowSubproductModal(false);
          setSelectedProduct(null);
          setSelectedOrderItemId(null);
        }
      } catch {
        if (requestId !== subproductsRequestIdRef.current) return;
        setSelectedProduct(null);
        setSelectedOrderItemId(null);
        setSubproducts([]);
        setShowSubproductModal(false);
      } finally {
        if (requestId === subproductsRequestIdRef.current) setLoadingSubproducts(false);
        productPressLockRef.current = false;
        setProductPressLocked(false);
      }
    },
    [fetchSubproductsForProduct, hydrateSubproducts, onAddProduct]
  );

  const handleSubproductPress = useCallback(
    async (subproduct) => {
      if (!selectedProduct || !selectedOrderItemId) return;
      const note = subproduct?.name || '';
      if (!note) return;
      const wasSelected = addedSubproductIds.has(subproduct.id);
      // Optimistic UI: reflect toggle immediately, then sync with backend result.
      setAddedSubproductIds((prev) => {
        const next = new Set(prev);
        if (next.has(subproduct.id)) next.delete(subproduct.id);
        else next.add(subproduct.id);
        return next;
      });
      let wasAdded = !wasSelected;
      try {
        wasAdded = await appendSubproductNoteToItem?.(
          selectedOrderItemId,
          note,
          Number(subproduct?.price) || 0
        );
      } catch {
        // Revert on request failure.
        setAddedSubproductIds((prev) => {
          const next = new Set(prev);
          if (wasSelected) next.add(subproduct.id);
          else next.delete(subproduct.id);
          return next;
        });
        return;
      }
      setAddedSubproductIds((prev) => {
        const next = new Set(prev);
        if (wasAdded) next.add(subproduct.id);
        else next.delete(subproduct.id);
        return next;
      });
    },
    [addedSubproductIds, appendSubproductNoteToItem, selectedOrderItemId, selectedProduct]
  );

  const closeSubproductModal = useCallback(() => {
    setShowSubproductModal(false);
    setSelectedProduct(null);
    setSelectedOrderItemId(null);
    setAddedSubproductIds(new Set());
  }, []);

  const subproductsByGroup = useMemo(() => {
    if (!subproducts.length) return [];
    const byGroup = new Map();
    for (const sp of subproducts) {
      const gid = sp?.groupId || sp?.group?.id || '';
      const gname = sp?.group?.name || '';
      if (!byGroup.has(gid)) byGroup.set(gid, { groupName: gname, sortOrder: sp?.group?.sortOrder ?? 0, items: [] });
      byGroup.get(gid).items.push(sp);
    }
    return Array.from(byGroup.entries())
      .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0) || (a[1].groupName || '').localeCompare(b[1].groupName || ''))
      .map(([gid, data]) => ({ groupId: gid, groupName: data.groupName, items: data.items }));
  }, [subproducts]);

  const colorStyleById = {
    green: { backgroundColor: '#83c664', color: '#ffffff' },
    blue: { backgroundColor: '#0000ff', color: '#ffffff' },
    pink: { backgroundColor: '#e97c64', color: '#ffffff' },
    orange: { backgroundColor: '#f0961c', color: '#ffffff' },
    yellow: { backgroundColor: '#ff2d3d', color: '#ffffff' },
    gray: { backgroundColor: '#4ab3ff', color: '#ffffff' }
  };
  const baseProductCellStyle = { position: 'relative', flex: 1, minWidth: 0 };
  const emptyProductCellStyle = { backgroundColor: 'rgba(44,62,80,0.2)' };
  const defaultProductCellStyle = { backgroundColor: '#34495e' };

  const dynamicTile = useMemo(() => {
    // Keep a strict 6x8 matrix (48 cells) inside the measured product area.
    const estimatedGridH = productAreaHeight > 0 ? productAreaHeight : 640;
    const tileHeight = Math.max(1, Math.floor((estimatedGridH - GRID_GAP * (GRID_ROWS - 1)) / GRID_ROWS));
    const visualBase = tileHeight;
    const imageSize = Math.round(clamp(visualBase * 0.58, 30, 68));
    const nameFontSize = Math.round(clamp(visualBase * 0.24, 9, 16));
    const priceFontSize = Math.round(clamp(visualBase * 0.24, 10, 17));
    return { tileHeight, imageSize, nameFontSize, priceFontSize };
  }, [GRID_GAP, GRID_ROWS, clamp, productAreaHeight]);

  return (
    <>
      <View className="flex-1 flex flex-col min-w-0 p-4 bg-pos-bg py-2">
        <View
          className="p-1 flex-1"
          onLayout={(e) => {
            const h = Number(e?.nativeEvent?.layout?.height) || 0;
            if (h > 0) setProductAreaHeight(h);
          }}
        >
          {!layoutForCategory ? (
            <View className="w-full flex items-center justify-center min-h-[100px] max-h-[100px]">
              <Text className="text-pos-surface text-lg text-center px-2">{t('selectCategoryToSeeProducts')}</Text>
            </View>
          ) : (
            <View className="w-full" style={{ rowGap: GRID_GAP }}>
              {Array.from({ length: GRID_ROWS }, (_, row) => (
                <View key={`product-row-${row}`} className="w-full flex-row" style={{ columnGap: GRID_GAP }}>
                  {Array.from({ length: GRID_COLS }, (_, col) => {
                    const idx = row * GRID_COLS + col;
                    const entry = pageCells[idx];
                    const product = typeof entry === 'string' && entry.startsWith('p:')
                      ? productById.get(entry.slice(2))
                      : null;
                    const absoluteIdx = pageStart + idx;
                    const colorId = colorForCategory[String(absoluteIdx)];
                    const tileStyle = colorStyleById[colorId] || undefined;

                    return (
                      <Pressable
                        key={`product-cell-${idx}`}
                        disabled={!product || productPressLocked || loadingSubproducts}
                        onPress={product ? () => handleProductPress(product) : undefined}
                        style={[
                          baseProductCellStyle,
                          { height: dynamicTile.tileHeight },
                          tileStyle || (product ? defaultProductCellStyle : emptyProductCellStyle),
                          (!product || productPressLocked || loadingSubproducts) ? { opacity: 0.7 } : null,
                        ]}
                      >
                        {product?.kassaPhotoPath ? (
                          <ExpoImage
                            source={{ uri: String(product.kassaPhotoPath) }}
                            className="absolute top-1 left-1 rounded"
                            style={{ width: dynamicTile.imageSize, height: dynamicTile.imageSize }}
                            contentFit="cover"
                          />
                        ) : null}
                        {product ? (
                          <>
                            <Text
                              className="absolute bottom-0 left-0 pl-1 leading-tight text-pos-text"
                              style={{ maxWidth: '72%', fontSize: dynamicTile.nameFontSize, lineHeight: dynamicTile.nameFontSize + 1 }}
                            >
                              {product.name}
                            </Text>
                            <Text
                              className="font-semibold absolute top-0 right-0 pr-1 pt-1 text-pos-text"
                              style={{ fontSize: dynamicTile.priceFontSize, lineHeight: dynamicTile.priceFontSize + 1 }}
                            >
                              €{Number(product.price).toFixed(2)}
                            </Text>
                          </>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {showSubproductModal && selectedProduct && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={closeSubproductModal}>
          <View style={{ flex: 1, width: windowWidth || 0, height: windowHeight || 0 }}>
            <Pressable style={styles.modalBackdrop} onPress={closeSubproductModal} />
            <View style={styles.modalCenterWrap}>
              <View
                className="bg-pos-bg rounded-xl border border-pos-border p-6 max-h-[90%]"
                style={{ width: Math.min(770, Math.max(320, windowWidth || 0) * 0.9) }}
              >
            {/* <View className="flex-row items-center justify-between mb-4">
              <Text className="text-md font-medium text-pos-text flex-1 pr-2">
                {selectedProduct.name} — {t('subproducts', 'Subproducts')}
              </Text>
              <Pressable
                className="p-2 rounded"
                onPress={closeSubproductModal}
                accessibilityLabel={t('close', 'Close')}
              >
                <Text className="text-pos-text text-2xl">×</Text>
              </Pressable>
            </View> */}
            <View className="space-y-6">
              {loadingSubproducts && subproducts.length === 0 ? (
                <View className="py-8">
                  <Text className="text-center text-pos-muted">{t('loading', 'Loading...')}</Text>
                </View>
              ) : null}
              {subproductsByGroup.map(({ groupId, groupName, items }) => (
                <View key={groupId} className='flex flex-row mb-2'>
                  <Text className="text-[10px] font-medium text-pos-text mb-2 min-w-[80px]">{groupName || t('other', 'Other')}</Text>
                  <View className="w-full flex flex-row flex-wrap gap-2">
                    {items.map((sp) => (
                      <Pressable
                        key={sp.id}
                        onPress={() => handleSubproductPress(sp)}
                        style={{
                          width: '17%',
                          minHeight: 45,
                          maxHeight: 45,
                          borderRadius: 8,
                          padding: 4,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: addedSubproductIds.has(sp.id) ? '#16a34a' : '#34495e'
                        }}
                      >
                        {sp.kioskPicture ? (
                          <ExpoImage source={{ uri: String(sp.kioskPicture) }} className="rounded" style={{ width: 40, height: 40 }} contentFit="cover" />
                        ) : null}
                        <View className="flex flex-col items-center justify-center">
                          <Text className="text-[10px] font-medium truncate w-full text-center text-white">{sp.name}</Text>
                          <Text className="text-[8px] text-white">€{Number(sp.price ?? 0).toFixed(2)}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <View className="w-full px-5 pb-2 flex-row justify-end gap-2 mt-6">
              <Pressable
                onPress={closeSubproductModal}
                style={{ paddingHorizontal: 16, paddingVertical: 8, flex: 1, borderRadius: 8, backgroundColor: '#34495e' }}
              >
                <Text className="text-pos-text text-center">{t('cancel', 'Cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={closeSubproductModal}
                style={{ paddingHorizontal: 16, paddingVertical: 8, flex: 1, borderRadius: 8, backgroundColor: '#16a34a' }}
              >
                <Text className="text-white text-center font-semibold">{t('ok', 'OK')}</Text>
              </Pressable>
            </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalCenterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

