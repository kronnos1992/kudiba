use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AccountClass {
    Class1MeiosFinanceiros,
    Class2Existencias,
    Class3Terceiros,
    Class4Imobilizacoes,
    Class5CapitalProprio,
    Class6Custos,
    Class7Proveitos,
    Class8Resultados,
}

impl AccountClass {
    pub fn from_account_code(code: &str) -> Option<Self> {
        let first_char = code.chars().next()?;
        match first_char {
            '1' => Some(Self::Class1MeiosFinanceiros),
            '2' => Some(Self::Class2Existencias),
            '3' => Some(Self::Class3Terceiros),
            '4' => Some(Self::Class4Imobilizacoes),
            '5' => Some(Self::Class5CapitalProprio),
            '6' => Some(Self::Class6Custos),
            '7' => Some(Self::Class7Proveitos),
            '8' => Some(Self::Class8Resultados),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Class1MeiosFinanceiros => "CLASS_1_MEIOS_FINANCEIROS",
            Self::Class2Existencias => "CLASS_2_EXISTENCIAS",
            Self::Class3Terceiros => "CLASS_3_TERCEIROS",
            Self::Class4Imobilizacoes => "CLASS_4_IMOBILIZACOES",
            Self::Class5CapitalProprio => "CLASS_5_CAPITAL_PROPRIO",
            Self::Class6Custos => "CLASS_6_CUSTOS",
            Self::Class7Proveitos => "CLASS_7_PROVEITOS",
            Self::Class8Resultados => "CLASS_8_RESULTADOS",
        }
    }
}
