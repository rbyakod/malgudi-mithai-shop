import "./index.css";
import { Composition } from "remotion";
import {
  MithaiHeroShowcase,
  mithaiHeroSchema,
} from "./MithaiHeroShowcase";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MithaiHeroShowcase"
      component={MithaiHeroShowcase}
      durationInFrames={405}
      fps={30}
      width={1920}
      height={1080}
      schema={mithaiHeroSchema}
      defaultProps={{
        brandName: "Your Mithai Brand",
      }}
    />
  );
};
