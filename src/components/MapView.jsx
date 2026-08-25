import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { boundsFromPoints, centerFromPoints } from '../utils/geo';

const DEFAULT_CENTER = [39.4, -105.5];
const DEFAULT_ZOOM = 7;

function MapClickForAddPill({ disabled, onPick, onClear }) {
  const map = useMap();
  useEffect(() => {
    if (disabled) return undefined;

    const MOVE_THRESHOLD_PX = 5;
    let pointerDown = null;
    let pointerMoved = false;
    let dragStarted = false;
    const container = map.getContainer();

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      pointerDown = { x: e.clientX, y: e.clientY };
      pointerMoved = false;
      dragStarted = false;
    };

    const onPointerMove = (e) => {
      if (!pointerDown) return;
      const dx = e.clientX - pointerDown.x;
      const dy = e.clientY - pointerDown.y;
      if (dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
        pointerMoved = true;
        onClear?.();
      }
    };

    const onPointerUp = () => {
      pointerDown = null;
    };

    const onDragStart = () => {
      dragStarted = true;
      pointerMoved = true;
      onClear?.();
    };

    const handler = (e) => {
      if (dragStarted) {
        dragStarted = false;
        return;
      }
      if (pointerMoved) return;

      const pt = map.latLngToContainerPoint(e.latlng);
      onPick({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        x: pt.x,
        y: pt.y,
      });
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    map.on('dragstart', onDragStart);
    map.on('click', handler);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      map.off('dragstart', onDragStart);
      map.off('click', handler);
    };
  }, [map, onPick, onClear, disabled]);
  return null;
}

function pinIcon(played) {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<span class="map-pin ${played ? 'map-pin--played' : ''}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function pointsFingerprint(points) {
  return points
    .map((p) => `${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}`)
    .sort()
    .join('|');
}

function FitBounds({ points }) {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;
  // Stable key so periodic course refreshes do not re-fit and wipe user zoom.
  const fingerprint = useMemo(() => pointsFingerprint(points), [points]);

  useEffect(() => {
    const pts = pointsRef.current;
    if (!pts.length) return;
    const bounds = boundsFromPoints(pts);
    if (!bounds?.isValid()) return;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
  }, [map, fingerprint]);

  return null;
}

function MapFocus({ selectedId, courses }) {
  const map = useMap();
  const selected = useMemo(() => {
    if (!selectedId) return null;
    const c = courses.find((x) => x.id === selectedId);
    return c ? { lat: c.lat, lng: c.lng } : null;
  }, [selectedId, courses]);

  useEffect(() => {
    if (!selected) return;
    const z = Math.max(map.getZoom(), 11);
    map.flyTo([selected.lat, selected.lng], z, { duration: 0.4 });
  }, [map, selectedId, selected?.lat, selected?.lng]);

  return null;
}

export function MapView({
  courses,
  selectedId,
  onEditCourse,
  addCourseFormOpen,
  onAddCourseAtLocation,
}) {
  const [pill, setPill] = useState(null);

  const points = useMemo(
    () => courses.map((c) => ({ lat: c.lat, lng: c.lng })),
    [courses]
  );
  const center = useMemo(
    () => (points.length ? centerFromPoints(points) : DEFAULT_CENTER),
    [points]
  );

  useEffect(() => {
    if (addCourseFormOpen) setPill(null);
  }, [addCourseFormOpen]);

  const handlePillClick = (e) => {
    e.stopPropagation();
    if (!pill) return;
    onAddCourseAtLocation?.(pill.lat, pill.lng);
    setPill(null);
  };

  const mapDisabled = Boolean(addCourseFormOpen);

  return (
    <div
      className={
        !courses.length
          ? 'map-shell map-shell--interactive map-shell--has-filter-hint'
          : 'map-shell map-shell--interactive'
      }
    >
      {!courses.length && (
        <p className="map-shell__hint">No pins match filters. Tap the map to add a course here.</p>
      )}
      <div className="map-shell__mapwrap">
        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          className="map-shell__leaflet"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.length > 0 && <FitBounds points={points} />}
          <MapFocus selectedId={selectedId} courses={courses} />
          <MapClickForAddPill
            disabled={mapDisabled}
            onPick={setPill}
            onClear={() => setPill(null)}
          />
          {courses.map((c) => (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={pinIcon(c.played)}
              eventHandlers={{
                click: () => onEditCourse?.(c.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                {c.name}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
        {pill && !mapDisabled && (
          <div
            className="map-add-pill-wrap"
            style={{ left: pill.x, top: pill.y }}
          >
            <button
              type="button"
              className="map-add-pill-btn"
              onClick={handlePillClick}
            >
              Add course
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
