import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CloudSun, LocateFixed, MapPin } from 'lucide-react';
import type { PlaceDto, ProfileDto } from '@living-draft/contracts';
import { searchPlaces } from '../../api/weather';
import { Button } from '../../components/ui/Button';
import { Segmented, TextInput, Toggle } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { readLocal, writeLocal } from '../../lib/storage';
import { WEATHER_KEY } from '../../lib/world/world';

const rounded = (value: number) => Math.round(value * 10) / 10;

export function PlaceSection({
  profile,
  save,
}: {
  profile: ProfileDto;
  save: (patch: Partial<ProfileDto>) => void;
}) {
  const client = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [room, setRoom] = useState(() => readLocal('weather-room') !== 'false');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchPlaces(q)
        .then(
          (found) => live && setResults(found),
          () => live && setResults([]),
        )
        .finally(() => live && setSearching(false));
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const settle = (patch: Partial<ProfileDto>) => {
    save(patch);
    void client.invalidateQueries({ queryKey: WEATHER_KEY });
  };

  const choose = (place: PlaceDto) => {
    settle({ placeName: place.label, placeLat: rounded(place.lat), placeLon: rounded(place.lon) });
    setQuery('');
    setResults([]);
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      toast("This device can't share its location. Type your town instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        settle({
          placeName: null,
          placeLat: rounded(position.coords.latitude),
          placeLon: rounded(position.coords.longitude),
        });
        toast('Got it. Only the rough area is kept.');
      },
      () => {
        setLocating(false);
        toast("Couldn't get your location. You can type your town instead.");
      },
      { enableHighAccuracy: false, maximumAge: 60 * 60_000, timeout: 12_000 },
    );
  };

  const hasPlace = profile.placeLat !== null && profile.placeLon !== null;
  const typing = query.trim().length >= 2;
  const shown = typing ? results : [];

  return (
    <section className="paper rounded-3xl p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <CloudSun className="size-5 text-gold" />
        Place and weather
      </h2>
      <div className="flex flex-col gap-5">
        <Toggle
          checked={profile.weatherOn}
          onChange={(v) => settle({ weatherOn: v })}
          label="Bring the weather in"
          description="Today's weather shows by the date and tints the page, and memories with a date and a place show what the sky was doing that day."
        />

        {profile.weatherOn && (
          <>
            <div>
              <p className="text-sm font-bold">Where you are</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                <MapPin className="size-4" />
                {hasPlace
                  ? (profile.placeName ?? 'Your rough area, from this device')
                  : 'Not set yet'}
              </p>
              <div className="relative mt-2 flex flex-wrap items-center gap-2">
                <TextInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a town or city"
                  aria-label="Search for a town"
                  className="max-w-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<LocateFixed className="size-4" />}
                  onClick={locate}
                  disabled={locating}
                >
                  {locating ? 'Finding you…' : 'Use my location'}
                </Button>
              </div>
              {typing && (shown.length > 0 || searching) && (
                <ul className="mt-2 max-w-sm overflow-hidden rounded-2xl border border-white/8 bg-white/4">
                  {searching && !shown.length && (
                    <li className="px-4 py-2.5 text-sm text-ink-faint">Looking…</li>
                  )}
                  {shown.map((place) => (
                    <li key={`${place.lat},${place.lon}`}>
                      <button
                        type="button"
                        onClick={() => choose(place)}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/8"
                      >
                        {place.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">How the app uses your location</p>
              <Segmented
                label="Location"
                value={profile.locationMode}
                onChange={(v) => settle({ locationMode: v })}
                options={[
                  { value: 'home', label: 'Home only' },
                  { value: 'travel', label: 'Also where I am now' },
                  { value: 'off', label: 'Never ask' },
                ]}
              />
              <p className="mt-1.5 text-xs text-ink-soft">
                {profile.locationMode === 'travel'
                  ? 'While the app is open, the weather follows where you are. Your home stays as it is.'
                  : profile.locationMode === 'off'
                    ? 'The app never asks for your location. Type a town above for weather.'
                    : 'Weather is always for your home, set once.'}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Temperature</p>
              <Segmented
                label="Temperature unit"
                value={profile.tempUnit}
                onChange={(v) => settle({ tempUnit: v })}
                options={[
                  { value: 'auto', label: 'Like my device' },
                  { value: 'c', label: '°C' },
                  { value: 'f', label: '°F' },
                ]}
              />
            </div>

            <Toggle
              checked={room}
              onChange={(v) => {
                setRoom(v);
                writeLocal('weather-room', v ? null : 'false');
                window.dispatchEvent(new Event('living-draft:room'));
              }}
              label="Let today's weather into the room"
              description="Rain on the window when it's raining out, snow when it snows. Memories still bring their own weather when you open them."
            />
          </>
        )}

        <p className="text-xs text-ink-soft">
          Weather comes from Open-Meteo, a free service that needs no account. To get it, the app
          sends your area rounded to about 10 km, never your exact spot. Towns you search for go to
          Open-Meteo&apos;s place search. For a memory with a date and a place, only that town and
          date are sent to look up the weather that day. Nothing else you wrote leaves this device.
        </p>
      </div>
    </section>
  );
}
