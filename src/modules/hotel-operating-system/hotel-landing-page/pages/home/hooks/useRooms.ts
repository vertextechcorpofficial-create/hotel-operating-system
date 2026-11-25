import { useState, useEffect } from "react";
import { RoomData } from "../types/room.types";

let cachedRooms: RoomData[] | null = null;
let inflightPromise: Promise<RoomData[]> | null = null;

function fetchRoomsOnce(): Promise<RoomData[]> {
  if (cachedRooms) return Promise.resolve(cachedRooms);
  if (!inflightPromise) {
    inflightPromise = fetch("/api/hotel-landing-page/rooms")
      .then((res) => res.json() as Promise<RoomData[]>)
      .then((data) => {
        cachedRooms = Array.isArray(data) ? data : [];
        return cachedRooms;
      })
      .finally(() => {
        inflightPromise = null;
      });
  }
  return inflightPromise;
}

export function useRooms() {
  const [rooms, setRooms] = useState<RoomData[]>(() => cachedRooms ?? []);
  const [loading, setLoading] = useState(!cachedRooms);

  useEffect(() => {
    if (cachedRooms) return;
    let active = true;
    fetchRoomsOnce()
      .then((data) => {
        if (active) {
          setRooms(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { rooms, loading };
}