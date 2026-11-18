import { MaterialShapes, roundedPolygonToPath } from "material-shapes-ts";

const FIELDS = [
  {
    name: "wash-a",
    d: roundedPolygonToPath(MaterialShapes.Cookie4Sided).toSvgPathData(),
    place: "translate(-210 -260) scale(860)",
  },
  {
    name: "wash-b",
    d: roundedPolygonToPath(MaterialShapes.Cookie12Sided).toSvgPathData(),
    place: "translate(1040 40) scale(560)",
  },
  {
    name: "wash-c",
    d: roundedPolygonToPath(MaterialShapes.Cookie7Sided).toSvgPathData(),
    place: "translate(120 720) scale(420)",
  },
] as const;

/** Large cookie fields in the theme colors, sitting behind the page. */
export function Atmosphere() {
  return (
    <svg className="atmosphere" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {FIELDS.map((field) => (
        <g key={field.name} className={`wash ${field.name}`}>
          <g transform={field.place}>
            <path d={field.d} />
          </g>
        </g>
      ))}
    </svg>
  );
}
