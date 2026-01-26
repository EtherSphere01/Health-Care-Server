const pick = <T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[],
): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    keys.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
            result[k] = obj[k];
        }
    });
    return result;
};

export default pick;
