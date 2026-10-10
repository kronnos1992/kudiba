from abc import ABC, abstractmethod
from typing import AsyncContextManager


class IUnitOfWork(ABC):
    """Porta para a Unidade de Trabalho (Unit of Work).
    Delimita a fronteira transacional ACID estrita de um comando,
    garantindo commit ou rollback atómico de todas as alterações.
    """
    @abstractmethod
    async def commit(self) -> None:
        """Confirma e persiste atomicamente todas as alterações da transação."""
        pass

    @abstractmethod
    async def rollback(self) -> None:
        """Reverte todas as alterações efetuadas na transação."""
        pass

    @abstractmethod
    async def __aenter__(self) -> "IUnitOfWork":
        pass

    @abstractmethod
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        pass


class IUnitOfWorkFactory(ABC):
    """Fábrica de Unidades de Trabalho."""
    @abstractmethod
    def begin(self) -> IUnitOfWork:
        """Inicia uma nova transação ACID delimitada."""
        pass
