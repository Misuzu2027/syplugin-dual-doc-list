import * as path from "path-browserify";



export const pathPosix = () => {
    if (path.posix) {
        return path.posix;
    }
    return path;
};

export const getDisplayName = (filePath: string, basename = true, removeSY = false) => {
    let name = filePath;
    if (basename) {
        name = pathPosix().basename(filePath);
    }
    if (removeSY && name.endsWith(".sy")) {
        name = name.substr(0, name.length - 3);
    }
    return name;
};