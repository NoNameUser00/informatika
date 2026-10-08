declare module 'astro:content' {
	interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"lessions": {
"9/9net-03-safe.md": {
	id: "9/9net-03-safe.md";
  slug: "9/9net-03-safe";
  body: string;
  collection: "lessions";
  data: any
} & { render(): Render[".md"] };
};
"lessons": {
"10/10gfx-01-image.md": {
	id: "10/10gfx-01-image.md";
  slug: "10/10gfx-01-image";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10gfx-02-sound.md": {
	id: "10/10gfx-02-sound.md";
  slug: "10/10gfx-02-sound";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10gfx-03-editor.md": {
	id: "10/10gfx-03-editor.md";
  slug: "10/10gfx-03-editor";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10gfx-04-vector.md": {
	id: "10/10gfx-04-vector.md";
  slug: "10/10gfx-04-vector";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10gfx-05-3d.md": {
	id: "10/10gfx-05-3d.md";
  slug: "10/10gfx-05-3d";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10hw-01-pc.md": {
	id: "10/10hw-01-pc.md";
  slug: "10/10hw-01-pc";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10hw-02-config.md": {
	id: "10/10hw-02-config.md";
  slug: "10/10hw-02-config";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10hw-03-trends.md": {
	id: "10/10hw-03-trends.md";
  slug: "10/10hw-03-trends";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10hw-04-software.md": {
	id: "10/10hw-04-software.md";
  slug: "10/10hw-04-software";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10hw-05-files.md": {
	id: "10/10hw-05-files.md";
  slug: "10/10hw-05-files";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10hw-06-licenses.md": {
	id: "10/10hw-06-licenses.md";
  slug: "10/10hw-06-licenses";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10info-01-measure.md": {
	id: "10/10info-01-measure.md";
  slug: "10/10info-01-measure";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10info-02-fano.md": {
	id: "10/10info-02-fano.md";
  slug: "10/10info-02-fano";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10info-03-content.md": {
	id: "10/10info-03-content.md";
  slug: "10/10info-03-content";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10info-04-processes.md": {
	id: "10/10info-04-processes.md";
  slug: "10/10info-04-processes";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10info-05-tasks.md": {
	id: "10/10info-05-tasks.md";
  slug: "10/10info-05-tasks";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-01-ops.md": {
	id: "10/10logic-01-ops.md";
  slug: "10/10logic-01-ops";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-02-transform.md": {
	id: "10/10logic-02-transform.md";
  slug: "10/10logic-02-transform";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-03-truth.md": {
	id: "10/10logic-03-truth.md";
  slug: "10/10logic-03-truth";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-04-normal.md": {
	id: "10/10logic-04-normal.md";
  slug: "10/10logic-04-normal";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-05-equations.md": {
	id: "10/10logic-05-equations.md";
  slug: "10/10logic-05-equations";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-06-venn.md": {
	id: "10/10logic-06-venn.md";
  slug: "10/10logic-06-venn";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-07-scheme.md": {
	id: "10/10logic-07-scheme.md";
  slug: "10/10logic-07-scheme";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-08-control.md": {
	id: "10/10logic-08-control.md";
  slug: "10/10logic-08-control";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10logic-09-errors.md": {
	id: "10/10logic-09-errors.md";
  slug: "10/10logic-09-errors";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10media-01-docs.md": {
	id: "10/10media-01-docs.md";
  slug: "10/10media-01-docs";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10media-02-review.md": {
	id: "10/10media-02-review.md";
  slug: "10/10media-02-review";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10media-03-typeset.md": {
	id: "10/10media-03-typeset.md";
  slug: "10/10media-03-typeset";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10media-04-multimedia.md": {
	id: "10/10media-04-multimedia.md";
  slug: "10/10media-04-multimedia";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10media-05-presentation.md": {
	id: "10/10media-05-presentation.md";
  slug: "10/10media-05-presentation";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10ss-01-systems.md": {
	id: "10/10ss-01-systems.md";
  slug: "10/10ss-01-systems";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10ss-02-transfer.md": {
	id: "10/10ss-02-transfer.md";
  slug: "10/10ss-02-transfer";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10ss-03-arith.md": {
	id: "10/10ss-03-arith.md";
  slug: "10/10ss-03-arith";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10ss-04-memory.md": {
	id: "10/10ss-04-memory.md";
  slug: "10/10ss-04-memory";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10ss-05-text.md": {
	id: "10/10ss-05-text.md";
  slug: "10/10ss-05-text";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"10/10ss-06-tasks.md": {
	id: "10/10ss-06-tasks.md";
  slug: "10/10ss-06-tasks";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11ai-01-intel.md": {
	id: "11/11ai-01-intel.md";
  slug: "11/11ai-01-intel";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11ai-02-pr.md": {
	id: "11/11ai-02-pr.md";
  slug: "11/11ai-02-pr";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11ai-04-pr3.md": {
	id: "11/11ai-04-pr3.md";
  slug: "11/11ai-04-pr3";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11ai-05-pr2.md": {
	id: "11/11ai-05-pr2.md";
  slug: "11/11ai-05-pr2";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-01-analysis.md": {
	id: "11/11algo-01-analysis.md";
  slug: "11/11algo-01-analysis";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-02-debug.md": {
	id: "11/11algo-02-debug.md";
  slug: "11/11algo-02-debug";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-03-digits.md": {
	id: "11/11algo-03-digits.md";
  slug: "11/11algo-03-digits";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-04-sequence.md": {
	id: "11/11algo-04-sequence.md";
  slug: "11/11algo-04-sequence";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-05-enumeration.md": {
	id: "11/11algo-05-enumeration.md";
  slug: "11/11algo-05-enumeration";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-06-sorting.md": {
	id: "11/11algo-06-sorting.md";
  slug: "11/11algo-06-sorting";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-07-matrix.md": {
	id: "11/11algo-07-matrix.md";
  slug: "11/11algo-07-matrix";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-08-strings.md": {
	id: "11/11algo-08-strings.md";
  slug: "11/11algo-08-strings";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-09-text-edit.md": {
	id: "11/11algo-09-text-edit.md";
  slug: "11/11algo-09-text-edit";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-10-subs.md": {
	id: "11/11algo-10-subs.md";
  slug: "11/11algo-10-subs";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11algo-11-complexity.md": {
	id: "11/11algo-11-complexity.md";
  slug: "11/11algo-11-complexity";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11data-01-analysis.md": {
	id: "11/11data-01-analysis.md";
  slug: "11/11data-01-analysis";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11data-02-stats.md": {
	id: "11/11data-02-stats.md";
  slug: "11/11data-02-stats";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11data-03-diagrams.md": {
	id: "11/11data-03-diagrams.md";
  slug: "11/11data-03-diagrams";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11data-04-correlation.md": {
	id: "11/11data-04-correlation.md";
  slug: "11/11data-04-correlation";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11data-05-equation.md": {
	id: "11/11data-05-equation.md";
  slug: "11/11data-05-equation";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11data-06-optimize.md": {
	id: "11/11data-06-optimize.md";
  slug: "11/11data-06-optimize";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11db-01-databases.md": {
	id: "11/11db-01-databases.md";
  slug: "11/11db-01-databases";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11db-02-queries.md": {
	id: "11/11db-02-queries.md";
  slug: "11/11db-02-queries";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11graph-01-graphs.md": {
	id: "11/11graph-01-graphs.md";
  slug: "11/11graph-01-graphs";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11graph-02-games.md": {
	id: "11/11graph-02-games.md";
  slug: "11/11graph-02-games";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11graph-02-paths.md": {
	id: "11/11graph-02-paths.md";
  slug: "11/11graph-02-paths";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11graph-03-table.md": {
	id: "11/11graph-03-table.md";
  slug: "11/11graph-03-table";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11model-01-modeling.md": {
	id: "11/11model-01-modeling.md";
  slug: "11/11model-01-modeling";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11net-01-networks.md": {
	id: "11/11net-01-networks.md";
  slug: "11/11net-01-networks";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11net-02-html.md": {
	id: "11/11net-02-html.md";
  slug: "11/11net-02-html";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11net-03-services.md": {
	id: "11/11net-03-services.md";
  slug: "11/11net-03-services";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11net-04-control.md": {
	id: "11/11net-04-control.md";
  slug: "11/11net-04-control";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11net-05-etiquette.md": {
	id: "11/11net-05-etiquette.md";
  slug: "11/11net-05-etiquette";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11safe-01-security.md": {
	id: "11/11safe-01-security.md";
  slug: "11/11safe-01-security";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11safe-02-malware.md": {
	id: "11/11safe-02-malware.md";
  slug: "11/11safe-02-malware";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"11/11safe-03-archive.md": {
	id: "11/11safe-03-archive.md";
  slug: "11/11safe-03-archive";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7code-01-sound.md": {
	id: "7/7code-01-sound.md";
  slug: "7/7code-01-sound";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7doc-01-text.md": {
	id: "7/7doc-01-text.md";
  slug: "7/7doc-01-text";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7doc-02-format.md": {
	id: "7/7doc-02-format.md";
  slug: "7/7doc-02-format";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7doc-03-styles.md": {
	id: "7/7doc-03-styles.md";
  slug: "7/7doc-03-styles";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7doc-04-lists.md": {
	id: "7/7doc-04-lists.md";
  slug: "7/7doc-04-lists";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7doc-05-objects.md": {
	id: "7/7doc-05-objects.md";
  slug: "7/7doc-05-objects";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7doc-06-citations.md": {
	id: "7/7doc-06-citations.md";
  slug: "7/7doc-06-citations";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7doc-07-vector.md": {
	id: "7/7doc-07-vector.md";
  slug: "7/7doc-07-vector";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7gfx-01-graphics.md": {
	id: "7/7gfx-01-graphics.md";
  slug: "7/7gfx-01-graphics";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7gfx-02-editors.md": {
	id: "7/7gfx-02-editors.md";
  slug: "7/7gfx-02-editors";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7gfx-03-color.md": {
	id: "7/7gfx-03-color.md";
  slug: "7/7gfx-03-color";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7gfx-04-raster.md": {
	id: "7/7gfx-04-raster.md";
  slug: "7/7gfx-04-raster";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7gfx-05-vector.md": {
	id: "7/7gfx-05-vector.md";
  slug: "7/7gfx-05-vector";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-01-info.md": {
	id: "7/7inf-01-info.md";
  slug: "7/7inf-01-info";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-02-coding.md": {
	id: "7/7inf-02-coding.md";
  slug: "7/7inf-02-coding";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-03-measure.md": {
	id: "7/7inf-03-measure.md";
  slug: "7/7inf-03-measure";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-04-textvolume.md": {
	id: "7/7inf-04-textvolume.md";
  slug: "7/7inf-04-textvolume";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-05-discrete.md": {
	id: "7/7inf-05-discrete.md";
  slug: "7/7inf-05-discrete";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-06-codes.md": {
	id: "7/7inf-06-codes.md";
  slug: "7/7inf-06-codes";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-07-volume.md": {
	id: "7/7inf-07-volume.md";
  slug: "7/7inf-07-volume";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-08-units.md": {
	id: "7/7inf-08-units.md";
  slug: "7/7inf-08-units";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-09-textvolume-2.md": {
	id: "7/7inf-09-textvolume-2.md";
  slug: "7/7inf-09-textvolume-2";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-10-control.md": {
	id: "7/7inf-10-control.md";
  slug: "7/7inf-10-control";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7inf-11-errors.md": {
	id: "7/7inf-11-errors.md";
  slug: "7/7inf-11-errors";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7media-01-slides.md": {
	id: "7/7media-01-slides.md";
  slug: "7/7media-01-slides";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7media-02-multi.md": {
	id: "7/7media-02-multi.md";
  slug: "7/7media-02-multi";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7media-03-links.md": {
	id: "7/7media-03-links.md";
  slug: "7/7media-03-links";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7net-01-internet.md": {
	id: "7/7net-01-internet.md";
  slug: "7/7net-01-internet";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7net-02-speed.md": {
	id: "7/7net-02-speed.md";
  slug: "7/7net-02-speed";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7net-03-safety.md": {
	id: "7/7net-03-safety.md";
  slug: "7/7net-03-safety";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7pc-01-hardware.md": {
	id: "7/7pc-01-hardware.md";
  slug: "7/7pc-01-hardware";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7pc-02-files.md": {
	id: "7/7pc-02-files.md";
  slug: "7/7pc-02-files";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7pc-02-software.md": {
	id: "7/7pc-02-software.md";
  slug: "7/7pc-02-software";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7pc-03-types.md": {
	id: "7/7pc-03-types.md";
  slug: "7/7pc-03-types";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7pc-04-safe.md": {
	id: "7/7pc-04-safe.md";
  slug: "7/7pc-04-safe";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"7/7soft-01-practice.md": {
	id: "7/7soft-01-practice.md";
  slug: "7/7soft-01-practice";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-01-performers.md": {
	id: "8/alg-01-performers.md";
  slug: "8/alg-01-performers";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-02-notation.md": {
	id: "8/alg-02-notation.md";
  slug: "8/alg-02-notation";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-03-branching.md": {
	id: "8/alg-03-branching.md";
  slug: "8/alg-03-branching";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-05-sequence.md": {
	id: "8/alg-05-sequence.md";
  slug: "8/alg-05-sequence";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-06-branching-short.md": {
	id: "8/alg-06-branching-short.md";
  slug: "8/alg-06-branching-short";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-07-while.md": {
	id: "8/alg-07-while.md";
  slug: "8/alg-07-while";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-08-until.md": {
	id: "8/alg-08-until.md";
  slug: "8/alg-08-until";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-09-for.md": {
	id: "8/alg-09-for.md";
  slug: "8/alg-09-for";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-10-pr-branching.md": {
	id: "8/alg-10-pr-branching.md";
  slug: "8/alg-10-pr-branching";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/alg-11-design.md": {
	id: "8/alg-11-design.md";
  slug: "8/alg-11-design";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/algo-01-results.md": {
	id: "8/algo-01-results.md";
  slug: "8/algo-01-results";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/algo-02-inputs.md": {
	id: "8/algo-02-inputs.md";
  slug: "8/algo-02-inputs";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/logic-01-utterances.md": {
	id: "8/logic-01-utterances.md";
  slug: "8/logic-01-utterances";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/logic-02-operations.md": {
	id: "8/logic-02-operations.md";
  slug: "8/logic-02-operations";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/logic-03-truth-tables.md": {
	id: "8/logic-03-truth-tables.md";
  slug: "8/logic-03-truth-tables";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/logic-04-elements.md": {
	id: "8/logic-04-elements.md";
  slug: "8/logic-04-elements";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/logic-05-expression.md": {
	id: "8/logic-05-expression.md";
  slug: "8/logic-05-expression";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/logic-06-laws.md": {
	id: "8/logic-06-laws.md";
  slug: "8/logic-06-laws";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/numsys-01-intro.md": {
	id: "8/numsys-01-intro.md";
  slug: "8/numsys-01-intro";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/numsys-02-binary.md": {
	id: "8/numsys-02-binary.md";
  slug: "8/numsys-02-binary";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/numsys-03-octal.md": {
	id: "8/numsys-03-octal.md";
  slug: "8/numsys-03-octal";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/numsys-04-hex.md": {
	id: "8/numsys-04-hex.md";
  slug: "8/numsys-04-hex";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/numsys-05-arith.md": {
	id: "8/numsys-05-arith.md";
  slug: "8/numsys-05-arith";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/numsys-06-review.md": {
	id: "8/numsys-06-review.md";
  slug: "8/numsys-06-review";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-01-basics.md": {
	id: "8/py-01-basics.md";
  slug: "8/py-01-basics";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-02-branching.md": {
	id: "8/py-02-branching.md";
  slug: "8/py-02-branching";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-03-loops.md": {
	id: "8/py-03-loops.md";
  slug: "8/py-03-loops";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-04-strings.md": {
	id: "8/py-04-strings.md";
  slug: "8/py-04-strings";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-05-data.md": {
	id: "8/py-05-data.md";
  slug: "8/py-05-data";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-06-linear.md": {
	id: "8/py-06-linear.md";
  slug: "8/py-06-linear";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-07-condition.md": {
	id: "8/py-07-condition.md";
  slug: "8/py-07-condition";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-08-strings-2.md": {
	id: "8/py-08-strings-2.md";
  slug: "8/py-08-strings-2";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-09-linear-pr.md": {
	id: "8/py-09-linear-pr.md";
  slug: "8/py-09-linear-pr";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-10-for-loops.md": {
	id: "8/py-10-for-loops.md";
  slug: "8/py-10-for-loops";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/py-11-for-loops-2.md": {
	id: "8/py-11-for-loops-2.md";
  slug: "8/py-11-for-loops-2";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"8/ss-30-control.md": {
	id: "8/ss-30-control.md";
  slug: "8/ss-30-control";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9algo-01-performers.md": {
	id: "9/9algo-01-performers.md";
  slug: "9/9algo-01-performers";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9arr-01-basics.md": {
	id: "9/9arr-01-basics.md";
  slug: "9/9arr-01-basics";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9arr-02-aggregates.md": {
	id: "9/9arr-02-aggregates.md";
  slug: "9/9arr-02-aggregates";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9arr-02-search.md": {
	id: "9/9arr-02-search.md";
  slug: "9/9arr-02-search";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9arr-03-extremes.md": {
	id: "9/9arr-03-extremes.md";
  slug: "9/9arr-03-extremes";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9arr-04-sort.md": {
	id: "9/9arr-04-sort.md";
  slug: "9/9arr-04-sort";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9graph-01-graphs.md": {
	id: "9/9graph-01-graphs.md";
  slug: "9/9graph-01-graphs";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9graph-02-trees.md": {
	id: "9/9graph-02-trees.md";
  slug: "9/9graph-02-trees";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9graph-03-tasks.md": {
	id: "9/9graph-03-tasks.md";
  slug: "9/9graph-03-tasks";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9graph-04-paths.md": {
	id: "9/9graph-04-paths.md";
  slug: "9/9graph-04-paths";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9intro-01-professions.md": {
	id: "9/9intro-01-professions.md";
  slug: "9/9intro-01-professions";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9model-01-models.md": {
	id: "9/9model-01-models.md";
  slug: "9/9model-01-models";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9model-02-math.md": {
	id: "9/9model-02-math.md";
  slug: "9/9model-02-math";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9model-03-mixed.md": {
	id: "9/9model-03-mixed.md";
  slug: "9/9model-03-mixed";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9model-04-table.md": {
	id: "9/9model-04-table.md";
  slug: "9/9model-04-table";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9net-01-internet.md": {
	id: "9/9net-01-internet.md";
  slug: "9/9net-01-internet";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9net-02-web.md": {
	id: "9/9net-02-web.md";
  slug: "9/9net-02-web";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9net-03-safe.md": {
	id: "9/9net-03-safe.md";
  slug: "9/9net-03-safe";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9net-04-services.md": {
	id: "9/9net-04-services.md";
  slug: "9/9net-04-services";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9net-05-collab.md": {
	id: "9/9net-05-collab.md";
  slug: "9/9net-05-collab";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9net-06-search.md": {
	id: "9/9net-06-search.md";
  slug: "9/9net-06-search";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9net-07-onlineoffice.md": {
	id: "9/9net-07-onlineoffice.md";
  slug: "9/9net-07-onlineoffice";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9net-08-onlineoffice2.md": {
	id: "9/9net-08-onlineoffice2.md";
  slug: "9/9net-08-onlineoffice2";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9robot-01-control.md": {
	id: "9/9robot-01-control.md";
  slug: "9/9robot-01-control";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9robot-02-systems.md": {
	id: "9/9robot-02-systems.md";
  slug: "9/9robot-02-systems";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-01-base.md": {
	id: "9/9sheet-01-base.md";
  slug: "9/9sheet-01-base";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-02-data.md": {
	id: "9/9sheet-02-data.md";
  slug: "9/9sheet-02-data";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-02-refs.md": {
	id: "9/9sheet-02-refs.md";
  slug: "9/9sheet-02-refs";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-03-analysis.md": {
	id: "9/9sheet-03-analysis.md";
  slug: "9/9sheet-03-analysis";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-03-functions.md": {
	id: "9/9sheet-03-functions.md";
  slug: "9/9sheet-03-functions";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-04-logic.md": {
	id: "9/9sheet-04-logic.md";
  slug: "9/9sheet-04-logic";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-05-filter.md": {
	id: "9/9sheet-05-filter.md";
  slug: "9/9sheet-05-filter";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-06-charts.md": {
	id: "9/9sheet-06-charts.md";
  slug: "9/9sheet-06-charts";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-07-model.md": {
	id: "9/9sheet-07-model.md";
  slug: "9/9sheet-07-model";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-08-tasks.md": {
	id: "9/9sheet-08-tasks.md";
  slug: "9/9sheet-08-tasks";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"9/9sheet-09-control.md": {
	id: "9/9sheet-09-control.md";
  slug: "9/9sheet-09-control";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
"tb-safety.md": {
	id: "tb-safety.md";
  slug: "tb-safety";
  body: string;
  collection: "lessons";
  data: any
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = never;
}
