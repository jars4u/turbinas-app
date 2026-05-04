import React from "react";
import {
  Box,
  ClickAwayListener,
  IconButton,
  InputAdornment,
  Paper,
  Popper,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePhone(value) {
  const raw = String(value || "").replace(/[\s-]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+58")) return raw;
  return "+58" + raw.replace(/^0+/, "");
}

export default function ClienteAutocompleteField({
  clientes = [],
  nombre = "",
  telefono = "",
  onNombreChange,
  onTelefonoChange,
  onClienteSelect,
  disabled = false,
  compact = false,
  labelNombre = "Cliente (Nombre)",
  labelTelefono = "Cliente (Teléfono)",
  showTelefono = true,
  telefonoPlaceholder = "+58-424-xxxxxxx",
  nombreSx,
  telefonoSx,
}) {
  const [inputValue, setInputValue] = React.useState(nombre || "");
  const [openSuggestions, setOpenSuggestions] = React.useState(false);
  const anchorRef = React.useRef(null);

  React.useEffect(() => {
    setInputValue(nombre || "");
  }, [nombre]);

  const filteredClientes = React.useMemo(() => {
    const q = normalizeText(inputValue);
    if (!q) return clientes || [];

    const terms = q.split(/\s+/).filter(Boolean);
    return (clientes || []).filter((option) => {
      const optionName = normalizeText(option?.nombre);
      if (!optionName) return false;

      const words = optionName.split(/\s+/).filter(Boolean);
      return terms.every((term, index) => {
        if (index < words.length) {
          return words[index]?.startsWith(term);
        }
        return optionName.includes(term);
      });
    });
  }, [clientes, inputValue]);

  const handleInputChange = React.useCallback((event) => {
    const value = event.target.value || "";
    setInputValue(value);
    setOpenSuggestions(true);

    if (typeof onNombreChange === "function") {
      onNombreChange(value, { event, reason: "input" });
    }
  }, [onNombreChange]);

  const handleSelect = React.useCallback((option) => {
    const nextNombre = option?.nombre || "";
    const nextTelefono = normalizePhone(option?.telefono || "");

    setInputValue(nextNombre);
    setOpenSuggestions(false);

    if (typeof onNombreChange === "function") {
      onNombreChange(nextNombre, { event: null, reason: "selectOption", option });
    }

    if (typeof onTelefonoChange === "function" && nextTelefono) {
      onTelefonoChange(nextTelefono, { event: null, reason: "selectOption", option });
    }

    if (typeof onClienteSelect === "function") {
      onClienteSelect(option, { event: null, reason: "selectOption" });
    }
  }, [onClienteSelect, onNombreChange, onTelefonoChange]);

  return (
    <ClickAwayListener onClickAway={() => setOpenSuggestions(false)}>
      <Box sx={{ width: "100%" }}>
        <Box ref={anchorRef} sx={{ width: "100%" }}>
          <TextField
            margin="none"
            label={labelNombre}
            name="customerName"
            fullWidth
            size="small"
            disabled={disabled}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setOpenSuggestions(true)}
            sx={{ width: "100%", ...nombreSx }}
            InputProps={{
              sx: { fontSize: "1rem", py: 0.5 },
              endAdornment: inputValue ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    edge="end"
                    onClick={() => {
                      setInputValue("");
                      setOpenSuggestions(false);
                      if (typeof onNombreChange === "function") {
                        onNombreChange("", { event: null, reason: "clear" });
                      }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>

        <Popper
          open={openSuggestions && filteredClientes.length > 0 && !disabled}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[
            {
              name: "offset",
              options: {
                offset: [0, 4],
              },
            },
          ]}
          sx={{
            zIndex: 1700,
            width: anchorRef.current ? anchorRef.current.clientWidth : undefined,
          }}
        >
          <Paper
            elevation={8}
            sx={{
              maxHeight: 280,
              overflowY: "auto",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {filteredClientes.map((option) => (
              <Box
                key={option.id || `${option.nombre}-${option.telefono}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(option);
                }}
                sx={{
                  px: 2,
                  py: 1,
                  cursor: "pointer",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: "none" },
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Typography variant="body2" sx={{ lineHeight: 1.2 }}>{option?.nombre || ""}</Typography>
                {option?.telefono && (
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                    {option.telefono}
                  </Typography>
                )}
              </Box>
            ))}
          </Paper>
        </Popper>

        {showTelefono && (
          <TextField
            margin="none"
            label={labelTelefono}
            name="customerPhone"
            fullWidth
            size="small"
            value={telefono ? (telefono.startsWith("+58") ? telefono : normalizePhone(telefono)) : ""}
            onChange={(event) => {
              if (typeof onTelefonoChange === "function") {
                onTelefonoChange(normalizePhone(event.target.value), { event, reason: "input" });
              }
            }}
            disabled={disabled}
            InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
            sx={{ mt: { xs: 0.75, sm: 1.25 }, ...telefonoSx }}
            placeholder={telefonoPlaceholder}
            helperText={
              telefono
                ? (/^\+58\d{10}$/.test(String(telefono).replace(/[-\s]/g, ""))
                  ? (compact ? "" : "Formato: +58-424-xxxxxxx")
                  : "Debe ser +58 seguido de 10 dígitos (ej: +584246065449)")
                : ""
            }
            error={telefono ? !/^\+58\d{10}$/.test(String(telefono).replace(/[-\s]/g, "")) : false}
          />
        )}
      </Box>
    </ClickAwayListener>
  );
}