use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AccountClass {
    Class0ContasDeOrdem,
    Class1MeiosFixosInvestimentos,
    Class2Existencias,
    Class3Terceiros,
    Class4MeiosMonetarios,
    Class5CapitalReservas,
    Class6ProveitosPorNatureza,
    Class7CustosPorNatureza,
    Class8Resultados,
}

impl AccountClass {
    pub fn from_account_code(code: &str) -> Option<Self> {
        let first_char = code.chars().next()?;
        match first_char {
            '0' => Some(Self::Class0ContasDeOrdem),
            '1' => Some(Self::Class1MeiosFixosInvestimentos),
            '2' => Some(Self::Class2Existencias),
            '3' => Some(Self::Class3Terceiros),
            '4' => Some(Self::Class4MeiosMonetarios),
            '5' => Some(Self::Class5CapitalReservas),
            '6' => Some(Self::Class6ProveitosPorNatureza),
            '7' => Some(Self::Class7CustosPorNatureza),
            '8' => Some(Self::Class8Resultados),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Class0ContasDeOrdem => "CLASS_0_CONTAS_DE_ORDEM",
            Self::Class1MeiosFixosInvestimentos => "CLASS_1_MEIOS_FIXOS_INVESTIMENTOS",
            Self::Class2Existencias => "CLASS_2_EXISTENCIAS",
            Self::Class3Terceiros => "CLASS_3_TERCEIROS",
            Self::Class4MeiosMonetarios => "CLASS_4_MEIOS_MONETARIOS",
            Self::Class5CapitalReservas => "CLASS_5_CAPITAL_RESERVAS",
            Self::Class6ProveitosPorNatureza => "CLASS_6_PROVEITOS_POR_NATUREZA",
            Self::Class7CustosPorNatureza => "CLASS_7_CUSTOS_POR_NATUREZA",
            Self::Class8Resultados => "CLASS_8_RESULTADOS",
        }
    }
}
