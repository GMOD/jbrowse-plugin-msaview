import Color from "color";

const colorSchemes = {
  clustal: {
    G: "orange",
    P: "orange",
    S: "orange",
    T: "orange",
    H: "red",
    K: "red",
    R: "red",
    F: "blue",
    W: "blue",
    Y: "blue",
    I: "green",
    L: "green",
    M: "green",
    V: "green",
  },
  lesk: {
    G: "orange",
    A: "orange",
    S: "orange",
    T: "orange",
    C: "green",
    V: "green",
    I: "green",
    L: "green",
    P: "green",
    F: "green",
    Y: "green",
    M: "green",
    W: "green",
    N: "magenta",
    Q: "magenta",
    H: "magenta",
    D: "red",
    E: "red",
    K: "blue",
    R: "blue",
  },
  maeditor: {
    A: "lightgreen",
    G: "lightgreen",
    C: "green",
    D: "darkgreen",
    E: "darkgreen",
    N: "darkgreen",
    Q: "darkgreen",
    I: "blue",
    L: "blue",
    M: "blue",
    V: "blue",
    F: "#c8a2c8",
    W: "#c8a2c8",
    Y: "#c8a2c8",
    H: "darkblue",
    K: "orange",
    R: "orange",
    P: "pink",
    S: "red",
    T: "red",
  },
  cinema: {
    H: "blue",
    K: "blue",
    R: "blue",
    D: "red",
    E: "red",
    S: "green",
    T: "green",
    N: "green",
    Q: "green",
    A: "white",
    V: "white",
    L: "white",
    I: "white",
    M: "white",
    F: "magenta",
    W: "magenta",
    Y: "magenta",
    P: "brown",
    G: "brown",
    C: "yellow",
    B: "gray",
    Z: "gray",
    X: "gray",
    "-": "gray",
    ".": "gray",
  },
};

function transform<T>(
  obj: Record<string, T>,
  cb: (arg0: [string, T]) => [string, T],
) {
  return Object.fromEntries(Object.entries(obj).map(cb));
}

// turn all supplied colors to hex colors which getContrastText from mui
// requires
export default transform(
  colorSchemes as Record<string, Record<string, string>>,
  ([key, val]) => {
    return [
      key,
      transform(val, ([letter, color]) => {
        return [letter, Color(color).hex()];
      }),
    ];
  },
);
