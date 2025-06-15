import MailIcon from "@/icons/GitHubIcon";
import InboxIcon from "@/icons/InfoOutlineIcon";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { forwardRef, Fragment, Ref, useImperativeHandle, useState } from "react";

type FilterMenuRef = {
  toggleDrawer: (open: boolean) => void;
  getState: () => boolean;
};

function FilterMenu(props: object, ref: Ref<FilterMenuRef>) {
  const [state, setState] = useState({
    top: false,
    left: false,
    bottom: false,
    right: false,
  });

  const toggleDrawer = (open: boolean) => {
    setState({ ...state, ["right"]: open });
  };

  const list = () => (
    <Box
      sx={{ width: 250 }}
      role="presentation"
      onClick={() => toggleDrawer(false)}
      onKeyDown={() => toggleDrawer(false)}
    >
      <List>
        {["Inbox", "Starred", "Send email", "Drafts"].map((text, index) => (
          <ListItem key={text} disablePadding>
            <ListItemButton>
              <ListItemIcon>{index % 2 === 0 ? <InboxIcon /> : <MailIcon />}</ListItemIcon>
              <ListItemText primary={text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {["All mail", "Trash", "Spam"].map((text, index) => (
          <ListItem key={text} disablePadding>
            <ListItemButton>
              <ListItemIcon>{index % 2 === 0 ? <InboxIcon /> : <MailIcon />}</ListItemIcon>
              <ListItemText primary={text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  useImperativeHandle(ref, () => ({
    toggleDrawer,
    getState: () => state.right,
  }));

  return (
    <div>
      <Fragment key={"right"}>
        {" "}
        <Drawer anchor={"right"} open={state["right"]} onClose={() => toggleDrawer(false)}>
          {list()}
        </Drawer>
      </Fragment>
    </div>
  );
}

export default forwardRef(FilterMenu);
