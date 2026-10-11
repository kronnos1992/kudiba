use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProductType {
    Goods,   // 'P' - Produto físico / Mercadoria
    Service, // 'S' - Prestação de serviços / Intangível
    Other,   // 'O' - Outros (adiantamentos, licenças perpétuas, taxas)
    Excise,  // 'E' - Impostos especiais de consumo
    Tax,     // 'I' - Impostos e encargos parafiscais
}

impl ProductType {
    pub fn as_saft_code(&self) -> &'static str {
        match self {
            ProductType::Goods => "P",
            ProductType::Service => "S",
            ProductType::Other => "O",
            ProductType::Excise => "E",
            ProductType::Tax => "I",
        }
    }

    pub fn from_saft_code(code: &str) -> Option<Self> {
        match code.trim().to_uppercase().as_str() {
            "P" => Some(ProductType::Goods),
            "S" => Some(ProductType::Service),
            "O" => Some(ProductType::Other),
            "E" => Some(ProductType::Excise),
            "I" => Some(ProductType::Tax),
            _ => None,
        }
    }

    pub fn is_stockable_by_default(&self) -> bool {
        matches!(self, ProductType::Goods)
    }

    pub fn allows_cargo_movement(&self) -> bool {
        matches!(self, ProductType::Goods)
    }

    pub fn requires_withholding_by_default(&self) -> bool {
        matches!(self, ProductType::Service)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn testa_propriedades_de_tipo() {
        assert!(ProductType::Goods.is_stockable_by_default());
        assert!(ProductType::Goods.allows_cargo_movement());
        assert!(!ProductType::Goods.requires_withholding_by_default());

        assert!(!ProductType::Service.is_stockable_by_default());
        assert!(!ProductType::Service.allows_cargo_movement());
        assert!(ProductType::Service.requires_withholding_by_default());

        assert_eq!(ProductType::from_saft_code("s"), Some(ProductType::Service));
        assert_eq!(ProductType::Service.as_saft_code(), "S");
    }
}
