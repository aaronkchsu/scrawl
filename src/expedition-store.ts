import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, isItem, validateSettings, type ItemId } from './expedition-catalog.ts';
import { validFinds, type Find } from './expedition-caves.ts';
import { validKeepsakes, type Keepsake } from './expedition-rescue.ts';
export type Profile = {
    id: string;
    name: string;
    hue: number;
    xp: number;
    ore: number;
    inventory: ItemId[];
    equipped: ItemId | null;
    climbs: number;
    keepsakes?: Keepsake[];
    finds?: Find[];
};
export class ProfileStore {
    profiles: Record<string, Profile> = {};
    settings = { ...DEFAULT_SETTINGS };
    error: string | null = null;
    constructor(privateFile?: string) {
        this.file = privateFile;
        if (!privateFile)
            return;
        try {
            const data = JSON.parse(readFileSync(privateFile, 'utf8'));
            if (data.version !== 1 || !data.profiles || typeof data.profiles !== 'object')
                throw new Error('Invalid save');
            if (data.settings)
                this.settings = validateSettings(data.settings);
            for (const [id, p] of Object.entries(data.profiles) as [
                string,
                any
            ][]) {
                if (!/^(demo|twitch):[a-zA-Z0-9_-]{1,50}$/.test(id) || p.id !== id || typeof p.name !== 'string' || !Array.isArray(p.inventory) || !p.inventory.every(isItem) || (p.equipped !== null && !p.inventory.includes(p.equipped)))
                    throw new Error('Invalid profile');
                if (![p.xp, p.ore, p.climbs, p.hue].every(n => Number.isSafeInteger(n) && n >= 0))
                    throw new Error('Invalid progress');
                if (p.keepsakes !== undefined && !validKeepsakes(p.keepsakes))
                    throw new Error('Invalid keepsakes');
                if (p.finds !== undefined && !validFinds(p.finds)) throw new Error('Invalid cave finds');
                p.finds ??= [];
                p.keepsakes ??= [];
                this.profiles[id] = p;
            }
        }
        catch (error: any) {
            if (error.code !== 'ENOENT')
                throw new Error('The excavation save could not be read. Back up and repair the file in .runtime before restarting; it has not been overwritten.');
        }
    }
    private file?: string;
    save() {
        if (!this.file)
            return;
        try {
            mkdirSync(dirname(this.file), { recursive: true });
            writeFileSync(`${this.file}.tmp`, JSON.stringify({ version: 1, profiles: this.profiles, settings: this.settings }), { mode: 0o600 });
            renameSync(`${this.file}.tmp`, this.file);
            this.error = null;
        }
        catch {
            this.error = 'Progress could not be saved. Check that the .runtime folder is writable, then click Retry save.';
        }
    }
}
