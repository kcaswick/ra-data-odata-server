import Parser from "fast-xml-parser";

export interface EntityProperty {
  Name: string;
  Type: string;
}

export interface EntityType {
  Property: EntityProperty[];
  Key?: EntityProperty;
}

export interface EntitySet {
  Name: string;
  Url: string;
  Type: EntityType;
  Key?: EntityProperty;
}

export function parse_metadata(t: string): Record<string, EntitySet> {
  const metadata = Parser.parse(t, {
    ignoreNameSpace: true,
    attributeNamePrefix: "_",
    ignoreAttributes: false,
    arrayMode: /Schema|EntityType|EntitySet/,
  });
  const entities: Record<string, EntityType> = {};
  for (const schema of metadata.Edmx.DataServices.Schema) {
    const namespace = schema._Namespace;
    for (const e of schema.EntityType ?? []) {
      //
      // Skip entity types with no key or with a compound key
      // as react-admin doesn't support such things
      //
      if ((e.Key && !Array.isArray(e.Key.PropertyRef)) || e._BaseType) {
        const name = `${namespace}.${e._Name}`;
        const properties: [EntityProperty] =
          (e.Property &&
            (e.Property instanceof Array ? e.Property : [e.Property]).map(
              (p: any) => ({
                Name: p._Name,
                Type: p._Type,
              })
            )) ??
          [];
        entities[name] = {
          Property: properties,
          Key: properties.find((p) => p.Name === e.Key?.PropertyRef?._Name),
        };
      }
    }
  }
  //
  // Handle derived entity types
  //
  for (const schema of metadata.Edmx.DataServices.Schema) {
    for (const d of (schema.EntityType ?? []).filter((e: any) => e._BaseType)) {
      const namespace = schema._Namespace;
      const base = entities[d._BaseType];
      if (base) {
        const name = `${namespace}.${d._Name}`;
        entities[name] = {
          Property: [...base.Property, ...entities[name].Property],
          Key: base.Key,
        };
      }
    }
  }
  const entitySets: Record<string, EntitySet> = {};
  for (const schema of metadata.Edmx.DataServices.Schema) {
    for (const set of schema.EntityContainer?.EntitySet ?? []) {
      //
      // skip entity sets composed of entity types we don't support
      // (no key or a compound key)
      //
      if (entities[set._EntityType]) {
        entitySets[set._Name.toLowerCase()] = {
          Name: set._Name,
          Url: set._Name,
          Type: entities[set._EntityType],
          Key: entities[set._EntityType].Key,
        };
      }
    }
  }
  return entitySets;
}
