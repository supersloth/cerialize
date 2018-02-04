import { getTarget, Indexable, isPrimitiveType, JsonType, SerializablePrimitiveType, SerializableType } from "./util";
import { MetaData, MetaDataFlag } from "./meta_data";

export function DeserializeMap<T>(data : any, type : SerializableType<T>, target? : Indexable<T>, createInstances = true) : Indexable<T> {

  if (typeof data !== "object") {
    throw new Error("Expected input to be of type `object` but received: " + typeof data);
  }

  if (target === null || target === void  0) target = {};

  if (data === null || data === void 0) {
    return null;
  }

  const keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = data[key];
    if (value !== void 0) {
      target[MetaData.deserializeKeyTransform(key)] = Deserialize(data[key], type, target[key], createInstances) as T;
    }
  }

  return target;
}

export function DeserializeArray<T>(data : any, type : SerializableType<T>, target? : Array<T>, createInstances = true) {

  if (!Array.isArray(data)) {
    throw new Error("Expected input to be an array but received: " + typeof data);
  }

  if (!Array.isArray(target)) target = [] as Array<T>;

  target.length = data.length;
  for (var i = 0; i < data.length; i++) {
    target[i] = Deserialize(data[i], type, target[i], createInstances) as T;
  }

  return target;
}


function DeserializePrimitive(data : any, type : SerializablePrimitiveType, target? : Date) {
  if (type === Date) {
    const deserializedDate = new Date(data as string);
    if (target instanceof Date) {
      target.setTime(deserializedDate.getTime());
    }
    else {
      return deserializedDate;
    }
  }
  else if (type === RegExp) {
    const fragments = data.match(/\/(.*?)\/([gimy])?$/);
    return new RegExp(fragments[1], fragments[2] || "");
  }
  else if (data === null) {
    return null;
  }
  else {
    return (type as any)(data);
  }
}

export function DeserializeJSON<T extends JsonType>(data : JsonType, transformKeys = true, target? : JsonType) : JsonType {

  if (data === null || data === void 0) {}

  if (Array.isArray(data)) {

    if (!Array.isArray(target)) target = new Array<any>(data.length);

    (target as Array<JsonType>).length = data.length;

    for (var i = 0; i < data.length; i++) {
      (target as Array<JsonType>)[i] = DeserializeJSON(data[i], transformKeys, (target as Array<JsonType>)[i]);
    }

    return target;
  }

  const type = typeof data;

  if (type === "object") {

    const retn = (target && typeof target === "object" ? target : {}) as Indexable<JsonType>;
    const keys = Object.keys(data as object);
    for (var i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = (data as Indexable<JsonType>)[key];
      if(value !== void 0) {
        const retnKey = transformKeys ? MetaData.deserializeKeyTransform(key) : key;
        retn[retnKey] = DeserializeJSON((data as Indexable<JsonType>)[key], transformKeys);
      }
    }
    return retn;

  }
  else if (type === "function") {
    throw new Error("Cannot deserialize a function, input is not a valid json object");
  }
  //primitive case
  return data;
}

export function Deserialize<T extends Indexable>(data : any, type : SerializableType<T>, target? : T, createInstances = true) : T | null {

  const metadataList = MetaData.getMetaDataForType(type);

  if (metadataList === null) {
    if (typeof type === "function") {
      if (isPrimitiveType(type)) {
        return DeserializePrimitive(data, type as any, target as any);
      }
      else if (createInstances) {
        return new (type as any)();
      }
      else {
        return {} as T;
      }
    }
    return null;
  }

  target = getTarget(type as any, target, createInstances) as T;

  for (var i = 0; i < metadataList.length; i++) {
    const metadata = metadataList[i];

    if (metadata.deserializedKey === null) continue;

    const source = data[metadata.getDeserializedKey()];

    if (source === void 0) continue;

    const keyName = metadata.keyName;
    const flags = metadata.flags;

    if ((flags & MetaDataFlag.DeserializeMap) !== 0) {
      target[keyName] = DeserializeMap(source, metadata.deserializedType, target[keyName], createInstances);
    }
    else if ((flags & MetaDataFlag.DeserializeArray) !== 0) {
      target[keyName] = DeserializeArray(source, metadata.deserializedType, target[keyName], createInstances);
    }
    else if ((flags & MetaDataFlag.DeserializePrimitive) !== 0) {
      target[keyName] = DeserializePrimitive(source, metadata.deserializedType as SerializablePrimitiveType, target[keyName]);
    }
    else if ((flags & MetaDataFlag.DeserializeObject) !== 0) {
      target[keyName] = Deserialize(source, metadata.deserializedType, target[keyName], createInstances);
    }
    else if ((flags & MetaDataFlag.DeserializeJSON) !== 0) {
      target[keyName] = DeserializeJSON(source, (flags & MetaDataFlag.DeserializeJSONTransformKeys) !== 0, createInstances);
    }
    else if ((flags & MetaDataFlag.DeserializeUsing) !== 0) {
      target[keyName] = (metadata.deserializedType as any)(source, target[keyName], createInstances);
    }

  }

  if (typeof type.onDeserialized === "function") {
    const value = type.onDeserialized(data, target, createInstances);
    if (value !== void 0) return value as any;
  }

  return target as T;
}