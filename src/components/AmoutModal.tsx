import GitHubIcon from "@mui/icons-material/GitHub";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Modal from "@mui/material/Modal";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import Typography from "@mui/material/Typography";
import { styled, Theme } from "@mui/material/styles";
import { default as Link } from "./TabLink";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 500,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

const Item = styled(Paper)(({ theme }: { theme: Theme }) => ({
  backgroundColor: "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
  flexGrow: 1,
  "&.dark": {
    backgroundColor: "#1A2027",
  },
}));

export default function AmoutModal({
  aboutOpen,
  setAboutOpen,
}: {
  aboutOpen: boolean;
  setAboutOpen: (open: boolean) => void;
}) {
  return (
    <div>
      <Modal
        onClick={() => setAboutOpen(false)}
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        aria-labelledby="application-title"
        aria-describedby="application-description"
        aria-contributors="application-contributors"
      >
        <Box sx={style}>
          <Typography
            id="application-title"
            variant="h6"
            component="h2"
            sx={{ textAlign: "center" }}
          >
            About ChemPare
            <Link href="https://github.com/jhyland87/chem-crawler/tree/main">
              <GitHubIcon fontSize="small" style={{ marginLeft: "10px" }} />
            </Link>
          </Typography>
          <Typography
            id="application-description"
            variant="subtitle2"
            gutterBottom
            sx={{ mt: 1, display: "block" }}
          >
            Open source project aimed at helping amateur chemistry hobbyists find the best deals on
            chemical reagents. There are plenty of similar services out there for businesses,
            universities and research institutions, but none are available for individuals and
            hobbyists. ChemPare only searches suppliers that sell to individuals and ship to
            residences.
          </Typography>
          <Divider sx={{ my: 2, fontSize: "0.8rem", color: "secondary.light" }}>
            <Typography variant="overline" gutterBottom sx={{ display: "block" }}>
              Contributors
            </Typography>
          </Divider>
          <Typography
            id="application-contributors"
            sx={{ mt: 1, fontSize: "0.8rem", textAlign: "center", color: "text.secondary" }}
          >
            <Stack spacing={{ xs: 1, sm: 2 }} direction="row" useFlexGap sx={{ flexWrap: "wrap" }}>
              <Item>
                <Link href="https://github.com/jhyland87">Justin Hyland</Link>
              </Item>
              <Item>
                <Link href="https://github.com/YourHeatingMantle">Maui3</Link>
              </Item>
              <Item>
                <Link href="https://github.com/spous">Spous</Link>
              </Item>
            </Stack>
          </Typography>
        </Box>
      </Modal>
    </div>
  );
}
